"""Leakage-aware rolling forecasts and a frozen 28-day holdout."""
from pathlib import Path
import os, json, hashlib, csv, platform
os.environ.setdefault('OMP_NUM_THREADS','2')
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT=Path(__file__).resolve().parents[1]
HORIZON=28
ORIGINS=[1857,1885]
TEST_ORIGIN=1913
NAMES={'weekly':'Weekly repeat','monthly':'28-day repeat','mean':'28-day mean','boost':'Poisson boosting'}
FEATURES=['sku','weekday','month','snap_ca','event','time','lag_1','lag_7','lag_14','lag_28','mean_7','mean_28','mean_56','zero_share_28']

def features(history, t, sku, cal):
    """At day index t, history contains observations/predictions strictly before t."""
    if len(history)!=t or t<56: raise ValueError('History must stop immediately before target day')
    c=cal.iloc[t]
    return [sku,c['weekday_num'],c['month'],c['snap_CA'],c['has_event'],t/1941,
            *[history[t-k] for k in [1,7,14,28]],
            *[np.mean(history[t-k:t]) for k in [7,28,56]],np.mean(np.array(history[t-28:t])==0)]

def fit_boost(values, origin, cal):
    x=[];y=[]
    for sku, series in enumerate(values):
        for t in range(56,origin):
            x.append(features(series[:t],t,sku,cal));y.append(series[t])
    model=HistGradientBoostingRegressor(loss='poisson',max_iter=140,max_leaf_nodes=15,
             learning_rate=.05,min_samples_leaf=30,l2_regularization=1,
             categorical_features=[0],early_stopping=False,random_state=42)
    return model.fit(np.array(x),np.array(y))

def forecast(values, origin, cal, name, horizon=HORIZON, model=None):
    histories=[list(s[:origin]) for s in values]
    if name=='boost' and model is None: model=fit_boost(values,origin,cal)
    for t in range(origin,origin+horizon):
        if name=='boost': pred=model.predict(np.array([features(h,t,i,cal) for i,h in enumerate(histories)]))
        elif name=='mean': pred=[np.mean(s[origin-28:origin]) for s in histories]
        else: pred=[s[t-(7 if name=='weekly' else 28)] for s in histories]
        for s,p in zip(histories,pred): s.append(max(0,float(p)))
    return np.array([s[origin:] for s in histories])

def scale(series):
    nonzero=np.flatnonzero(series)
    if not len(nonzero): return None
    diffs=np.diff(series[nonzero[0]:])
    denom=float(np.mean(diffs**2)) if len(diffs) else 0
    return denom if denom>0 else None

def metrics(actual,pred,train):
    error=pred-actual; denom=float(actual.sum())
    rms=[]
    for a,p,s in zip(actual,pred,train):
        d=scale(s)
        if d is not None: rms.append(float(np.sqrt(np.mean((a-p)**2)/d)))
    return {'wape':float(np.abs(error).sum()/denom) if denom else None,
            'mae':float(np.abs(error).mean()),'bias':float(error.sum()/denom) if denom else None,
            'rmsse':float(np.mean(rms)) if rms else None,'rmsseSeries':len(rms),
            'absoluteError':float(np.abs(error).sum()),'actualUnits':denom}

def rounded(a): return np.round(a,5).tolist()

def main():
    frame=pd.read_csv(ROOT/'data/sales_subset.csv');cal=pd.read_csv(ROOT/'data/calendar.csv')
    cal['weekday_num']=pd.to_datetime(cal['date']).dt.dayofweek
    cal['has_event']=cal['event_name_1'].notna().astype(int)
    values=frame[[f'd_{i}' for i in range(1,1942)]].to_numpy(dtype=float)
    if values.shape!=(12,1941) or not np.isfinite(values).all() or np.any(values<0): raise ValueError('Invalid input')
    reports={};predictions={};validation={}
    for name in NAMES:
        predictions[name]={};errors=[];actual_total=0;abs_total=0;folds=[]
        for origin in ORIGINS:
            print('Validation',name,origin,flush=True)
            pred=forecast(values,origin,cal,name);actual=values[:,origin:origin+28]
            m=metrics(actual,pred,values[:,:origin]);folds.append({'origin':origin,**m})
            predictions[name][str(origin)]=rounded(pred)
            errors.append(np.abs(actual-pred));actual_total+=float(actual.sum());abs_total+=m['absoluteError']
        validation[name]=np.concatenate(errors,axis=1)
        reports[name]={'label':NAMES[name],'validationWape':abs_total/actual_total,'folds':folds}
    winner=min(reports,key=lambda k:reports[k]['validationWape'])
    # Selection is frozen before reading/scoring the final holdout.
    widths=np.quantile(validation[winner],.9,axis=1,method='higher')
    for name in NAMES:
        print('Final test',name,flush=True)
        pred=forecast(values,TEST_ORIGIN,cal,name)
        predictions[name]['test']=rounded(pred)
        reports[name]['test']=metrics(values[:,TEST_ORIGIN:],pred,values[:,:TEST_ORIGIN])
    print('Selected',winner,'Refit all historical observations',flush=True)
    future=forecast(values,1941,cal,winner)
    selected=np.array(predictions[winner]['test'])
    lower=np.maximum(0,selected-widths[:,None]);upper=selected+widths[:,None]
    coverage=float(np.mean((values[:,TEST_ORIGIN:]>=lower)&(values[:,TEST_ORIGIN:]<=upper)))
    series=[]
    for i,row in frame.iterrows():
        history=values[i]; nz=np.count_nonzero(history[-365:]); avg=float(history[-28:].mean())
        series.append({'id':row.item_id,'category':row.cat_id,'department':row.dept_id,'store':row.store_id,
          'history':history.astype(int).tolist(),'forecast':rounded(future[i]),'bandRadius':round(float(widths[i]),5),
          'lower':rounded(np.maximum(0,future[i]-widths[i])),'upper':rounded(future[i]+widths[i]),
          'recentMean':avg,'zeroShare':float(1-nz/365),'test':metrics(values[i:i+1,1913:],selected[i:i+1],values[i:i+1,:1913])})
    report={'selected':winner,'names':NAMES,'horizon':28,'origins':ORIGINS,'testOrigin':TEST_ORIGIN,
      'historyStart':str(cal.iloc[0]['date']),'historyEnd':str(cal.iloc[1940]['date']),
      'futureStart':str(cal.iloc[1941]['date']),'futureEnd':str(cal.iloc[1968]['date']),
      'testStart':str(cal.iloc[1913]['date']),'testEnd':str(cal.iloc[1940]['date']),
      'coverage':coverage,'bandMethod':'Per-series 90th percentile absolute errors from 56 validation forecasts; higher quantile, clipped lower bound. Empirical error envelope, not guaranteed prediction coverage.',
      'models':reports,'features':FEATURES,'versions':{'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__,'sklearn':sklearn.__version__},
      'dataHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'data/calendar.csv',ROOT/'data/sales_subset.csv']}}
    out=ROOT/'dist/data';out.mkdir(parents=True,exist_ok=True)
    app={'report':report,'dates':cal['date'].iloc[:1969].tolist(),'series':series,'predictions':predictions}
    (out/'forecast.json').write_text(json.dumps(app,separators=(',',':'),allow_nan=False),encoding='utf-8')
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/evaluation.json').write_text(json.dumps(report,indent=2,allow_nan=False),encoding='utf-8')
    with (ROOT/'reports/forecast.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f);w.writerow(['item_id','date','predicted_units','lower_envelope','upper_envelope'])
        for s in series:
            for i,date in enumerate(app['dates'][1941:]):w.writerow([s['id'],date,s['forecast'][i],s['lower'][i],s['upper'][i]])
    print(json.dumps({'selected':winner,'validationWape':reports[winner]['validationWape'],'test':reports[winner]['test'],'coverage':coverage}),flush=True)

if __name__=='__main__': main()
