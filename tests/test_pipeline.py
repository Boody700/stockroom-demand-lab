import unittest, sys, json, hashlib
from pathlib import Path
import numpy as np
import pandas as pd
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from train import features, forecast, metrics, scale

class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=json.loads((ROOT/'dist/data/forecast.json').read_text(encoding='utf-8'))
        cls.values=np.array([s['history'] for s in cls.app['series']],dtype=float)
        cls.cal=pd.read_csv(ROOT/'data/calendar.csv')
        cls.cal['weekday_num']=pd.to_datetime(cls.cal.date).dt.dayofweek
        cls.cal['has_event']=cls.cal.event_name_1.notna().astype(int)
    def test_input_checksums_shape_and_dates(self):
        self.assertEqual(self.values.shape,(12,1941))
        self.assertTrue(np.isfinite(self.values).all())
        self.assertTrue((self.values>=0).all())
        self.assertEqual(self.app['dates'][0],'2011-01-29')
        self.assertEqual(self.app['dates'][1940],'2016-05-22')
        for name,digest in self.app['report']['dataHashes'].items():self.assertEqual(hashlib.sha256((ROOT/'data'/name).read_bytes()).hexdigest(),digest)
    def test_feature_window_excludes_target(self):
        history=np.arange(100,dtype=float)
        f=features(history,100,0,self.cal)
        self.assertEqual(f[6:10],[99,93,86,72])
        self.assertEqual(f[10],np.mean(history[-7:]))
        with self.assertRaises(ValueError):features(np.arange(101),100,0,self.cal)
    def test_forecast_is_invariant_to_future_actuals(self):
        # Includes retraining the ML candidate; altered validation/test labels cannot enter fitting or recursion.
        altered=self.values.copy();altered[:,1857:]=999999
        for name in ['weekly','monthly','mean','boost']:
            a=forecast(self.values,1857,self.cal,name)
            b=forecast(altered,1857,self.cal,name)
            np.testing.assert_allclose(a,b,rtol=0,atol=0)
    def test_selection_uses_only_validation_scores(self):
        report=self.app['report'];models=report['models']
        self.assertEqual(report['selected'],min(models,key=lambda k:models[k]['validationWape']))
        for m in models.values():self.assertAlmostEqual(m['validationWape'],sum(f['absoluteError'] for f in m['folds'])/sum(f['actualUnits'] for f in m['folds']))
    def test_all_test_metrics_reconcile(self):
        for k,p in self.app['predictions'].items():
            m=metrics(self.values[:,1913:],np.array(p['test']),self.values[:,:1913])
            for field in ['wape','mae','rmsse','bias']:self.assertAlmostEqual(m[field],self.app['report']['models'][k]['test'][field],places=5)
    def test_rmsse_trims_leading_zeros_and_handles_degenerate_series(self):
        self.assertEqual(scale(np.array([0,0,2,4,2])),4)
        self.assertIsNone(scale(np.zeros(6)))
        self.assertIsNone(scale(np.ones(6)))
        self.assertIsNone(metrics(np.zeros((1,2)),np.ones((1,2)),np.zeros((1,5)))['wape'])
    def test_envelope_uses_validation_residuals_only(self):
        key=self.app['report']['selected'];preds=self.app['predictions'][key]
        errors=np.concatenate([np.abs(self.values[:,o:o+28]-np.array(preds[str(o)])) for o in [1857,1885]],axis=1)
        widths=np.quantile(errors,.9,axis=1,method='higher')
        np.testing.assert_allclose(widths,[s['bandRadius'] for s in self.app['series']],atol=1e-5)
        test=np.array(preds['test']);actual=self.values[:,1913:]
        coverage=np.mean((actual>=np.maximum(0,test-widths[:,None]))&(actual<=test+widths[:,None]))
        self.assertEqual(coverage,self.app['report']['coverage'])

if __name__=='__main__':unittest.main()
