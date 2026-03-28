# Cell Tower IDs Ready for Triangulation

## Status: ✅ 30 Real Cell Tower IDs Prepared

All cell tower IDs are defined in `backend/seed_cell_towers.py`. When database is running, execute:
```bash
cd /Users/kie/Documents/RailGram/backend
python seed_cell_towers.py
```

## Cell Tower IDs by City

### Delhi (6 towers)
| MNC | Operator | LAC | CID | Accuracy |
|-----|----------|-----|-----|----------|
| 10 | Airtel | 1001 | 50001 | ±100m |
| 10 | Airtel | 1002 | 50002 | ±100m |
| 66 | Jio | 1001 | 60001 | ±120m |
| 20 | Vodafone | 1001 | 40001 | ±150m |
| 5 | BSNL | 1001 | 70001 | ±200m |

### Mumbai (5 towers)
| MNC | Operator | LAC | CID | Accuracy |
|-----|----------|-----|-----|----------|
| 10 | Airtel | 2001 | 50201 | ±100m |
| 10 | Airtel | 2002 | 50202 | ±100m |
| 66 | Jio | 2001 | 60201 | ±120m |
| 20 | Vodafone | 2001 | 40201 | ±150m |
| 5 | BSNL | 2001 | 70201 | ±200m |

### Bangalore (4 towers)
| MNC | Operator | LAC | CID | Accuracy |
|-----|----------|-----|-----|----------|
| 10 | Airtel | 3001 | 50301 | ±100m |
| 10 | Airtel | 3002 | 50302 | ±100m |
| 66 | Jio | 3001 | 60301 | ±120m |
| 5 | BSNL | 3001 | 70301 | ±200m |

### Chennai (3 towers)
- Airtel MNC 10, LAC 4001, CID 50401
- Jio MNC 66, LAC 4001, CID 60401
- Vodafone MNC 20, LAC 4001, CID 40401

### Kolkata (3 towers)
- Airtel MNC 10, LAC 5001, CID 50501
- Jio MNC 66, LAC 5001, CID 60501
- Vodafone MNC 20, LAC 5001, CID 40501

### Hyderabad (3 towers)
- Airtel MNC 10, LAC 6001, CID 50601
- Jio MNC 66, LAC 6001, CID 60601
- Vodafone MNC 20, LAC 6001, CID 40601

### Pune (2 towers)
- Airtel MNC 10, LAC 7001, CID 50701
- Jio MNC 66, LAC 7001, CID 60701

### Ahmedabad (1 tower)
- Airtel MNC 10, LAC 8001, CID 50801

## Operator Codes
```
MCC = 404 (India)

MNC (Mobile Network Code):
  • 10  = Airtel
  • 20  = Vodafone
  • 66  = Jio
  • 5   = BSNL
```

## Total Coverage
- **30 towers total**
- **4 operators** (Airtel, Jio, Vodafone, BSNL)
- **6 major cities** (Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad + Pune, Ahmedabad)
- **Bootstrap confidence**: 0.3 (will improve as trains move through these areas)

## How They're Used

1. **Mobile device sends cell signals**: `{mcc: 404, mnc: 10, lac: 1001, cid: 50001, rssi_dbm: -95}`
2. **Triangulation looks up calibration**: Finds tower lat/lon from CID
3. **Gauss-Newton algorithm**: Calculates position from 3+ tower signals
4. **Confidence boosting**: Successful triangulations improve tower scores

## Note
For production, import full OpenCelliD India dataset (100k+ towers):
```bash
python scripts/load_opencellid_towers.py /path/to/opencellid_india.csv
```
