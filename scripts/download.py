"""Stream a fixed, preselected M5 subset without saving the 122 MB source file."""
from pathlib import Path
import csv, io, json, hashlib, urllib.request

ROOT = Path(__file__).resolve().parents[1]
ITEMS = [f'HOBBIES_1_{i:03}' for i in [1,4,8,9]] + [f'HOUSEHOLD_1_{i:03}' for i in [1,9,13,20]] + [f'FOODS_3_{i:03}' for i in [90,120,150,200]]
BASE = 'https://zenodo.org/records/10203108/files/'

def stream(name):
    req = urllib.request.Request(BASE + name + '?download=1', headers={'User-Agent':'StockroomPortfolio/1.0'})
    return urllib.request.urlopen(req, timeout=90)

def main():
    target = ROOT / 'data'; target.mkdir(exist_ok=True)
    with stream('calendar.csv') as response:
        calendar = response.read()
    (target / 'calendar.csv').write_bytes(calendar)
    rows = []
    with stream('sales_train_evaluation.csv') as response:
        reader = csv.DictReader(io.TextIOWrapper(response, encoding='utf-8'))
        fields = reader.fieldnames
        for row in reader:
            if row['store_id'] == 'CA_1' and row['item_id'] in ITEMS:
                rows.append(row)
                print('Selected', row['item_id'], flush=True)
                if len(rows) == len(ITEMS): break
    if len(rows) != len(ITEMS): raise RuntimeError('Missing fixed series')
    rows.sort(key=lambda r: ITEMS.index(r['item_id']))
    subset = target / 'sales_subset.csv'
    with subset.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fields);writer.writeheader();writer.writerows(rows)
    manifest = {'source': 'https://zenodo.org/records/10203108', 'original':'M5 / University of Nicosia / Walmart', 'store':'CA_1', 'items':ITEMS, 'selection':'Fixed identifiers chosen before inspecting forecasts or evaluation scores; illustrative subset, not representative sampling.', 'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [target/'calendar.csv',subset]}}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Saved 12 fixed series and calendar.', flush=True)

if __name__ == '__main__': main()
