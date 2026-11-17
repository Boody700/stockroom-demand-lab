"""Optional shareable figure; the interactive app does not depend on matplotlib."""
from pathlib import Path
import os, json
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'.cache/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

def main():
    d=json.loads((ROOT/'dist/data/forecast.json').read_text(encoding='utf-8'));r=d['report']
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
    fig=plt.figure(figsize=(13,9),facecolor='#f5f5ed');gs=fig.add_gridspec(2,2,height_ratios=[1,1.1],hspace=.5,wspace=.35)
    ax=fig.add_subplot(gs[0,:]);s=next(x for x in d['series'] if x['id']=='FOODS_3_090');i=d['series'].index(s);pred=np.array(d['predictions'][r['selected']]['test'][i]);x=np.arange(1,29)
    ax.fill_between(x,np.maximum(0,pred-s['bandRadius']),pred+s['bandRadius'],color='#ec683f',alpha=.17,label='Validation-error envelope')
    ax.plot(x,s['history'][-28:],color='#263d2c',lw=2,label='Observed sales');ax.plot(x,pred,color='#d95f32',lw=2,label='Selected Poisson boosting')
    ax.set(title='Held-out daily sales / FOODS_3_090 at CA_1',xlabel='Test day / 25 Apr–22 May 2016',ylabel='Units');ax.legend(frameon=False,ncol=3,loc='upper left',fontsize=9);ax.grid(axis='y',alpha=.15)
    ax=fig.add_subplot(gs[1,0]);keys=list(r['models']);x=np.arange(4);ax.bar(x-.18,[r['models'][k]['validationWape']*100 for k in keys],width=.36,color='#87966e',label='Rolling validation');ax.bar(x+.18,[r['models'][k]['test']['wape']*100 for k in keys],width=.36,color='#ec683f',label='Final test');ax.set_xticks(x,['Weekly\nrepeat','28-day\nrepeat','28-day\nmean','Poisson\nboosting']);ax.set(ylabel='Pooled WAPE (%)',title='Selection used validation only');ax.legend(frameon=False,fontsize=9);ax.grid(axis='y',alpha=.15)
    ax=fig.add_subplot(gs[1,1]);order=sorted(d['series'],key=lambda s:s['test']['wape']);ax.barh([s['id'] for s in order],[s['test']['wape']*100 for s in order],color=['#ec683f' if s['category']=='FOODS' else '#87966e' for s in order]);ax.tick_params(axis='y',labelsize=8);ax.set(xlabel='Product WAPE (%)',title='Pooled results hide uneven item errors');ax.grid(axis='x',alpha=.15)
    fig.suptitle('STOCKROOM / A small, inspectable forecasting study',x=.07,y=.98,ha='left',fontsize=18,fontweight='bold');fig.text(.07,.935,'12 fixed M5 series · one store · 28-day horizon · no claim of full-competition or production performance',fontsize=10,color='#66705c')
    fig.subplots_adjust(top=.86,bottom=.12,left=.07,right=.97);fig.text(.07,.03,'Source: M5 / University of Nicosia, Zenodo 10203108. Envelopes are descriptive, not guaranteed coverage.\nInventory inputs are illustrative; no stock savings or service level was measured.',fontsize=9,color='#66705c')
    fig.savefig(ROOT/'reports/evaluation.png',dpi=150,facecolor=fig.get_facecolor());plt.close(fig)
if __name__=='__main__':main()
