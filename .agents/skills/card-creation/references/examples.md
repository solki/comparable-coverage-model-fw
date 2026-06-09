# Card Creation Code Examples

## CLI Workflow (Recommended)

### Step 1: Discover columns

```bash
community-domo-cli --output json datasets schema $DATASET_ID > schema.json
```

### Step 2: Build card JSON

```bash
cat > card.json << 'EOF'
{
  "definition": {
    "subscriptions": {
      "big_number": {
        "name": "big_number",
        "columns": [
          {"column": "Revenue", "aggregation": "SUM", "alias": "Revenue", "format": {"type": "abbreviated", "format": "#A"}}
        ],
        "filters": []
      },
      "main": {
        "name": "main",
        "columns": [
          {"column": "Team", "mapping": "ITEM"},
          {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM"}
        ],
        "filters": [],
        "orderBy": [],
        "groupBy": [{"column": "Team"}],
        "fiscal": false,
        "projection": false,
        "distinct": false
      }
    },
    "formulas": {"dsUpdated": [], "dsDeleted": [], "card": []},
    "annotations": {"new": [], "modified": [], "deleted": []},
    "conditionalFormats": {"card": [], "datasource": []},
    "controls": [],
    "segments": {"active": [], "create": [], "update": [], "delete": []},
    "charts": {
      "main": {
        "component": "main",
        "chartType": "badge_vert_bar",
        "overrides": {},
        "goal": null
      }
    },
    "dynamicTitle": {"text": [{"text": "Revenue by Team", "type": "TEXT"}]},
    "dynamicDescription": {"text": [{"text": "Sum of revenue grouped by team", "type": "TEXT"}], "displayOnCardDetails": true},
    "chartVersion": "12",
    "inputTable": false,
    "noDateRange": false,
    "title": "Revenue by Team",
    "description": "Sum of revenue grouped by team"
  },
  "dataProvider": {"dataSourceId": "DATASET_UUID_HERE"},
  "variables": true,
  "columns": false
}
EOF
```

### Step 3: Create the card

```bash
community-domo-cli --output json -y cards create \
  --body-file card.json --page-id $PAGE_ID > card_response.json

CARD_ID=$(python3 -c "import json; print(json.load(open('card_response.json'))['id'])")
echo "Created card: $CARD_ID"
```

### Step 4: Verify

```bash
community-domo-cli --output json cards definition $CARD_ID | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"Chart: {d['definition']['charts']['main']['chartType']}\")
print(f\"Title: {d['definition']['title']}\")
print(f\"Columns: {len(d['definition']['subscriptions']['main']['columns'])}\")
"
```

## Read → Modify → Update Pattern

```bash
# Read current definition
community-domo-cli --output json cards definition $CARD_ID > current.json

# Modify with Python
python3 << 'PYEOF'
import json

with open("current.json") as f:
    card = json.load(f)

defn = card["definition"]

# Fix read→write format mismatches
if isinstance(defn.get("formulas"), list):
    defn["formulas"] = {"dsUpdated": [], "dsDeleted": [], "card": []}
if isinstance(defn.get("conditionalFormats"), list):
    defn["conditionalFormats"] = {"card": [], "datasource": []}
if isinstance(defn.get("annotations"), list):
    defn["annotations"] = {"new": [], "modified": [], "deleted": []}
if isinstance(defn.get("segments"), dict) and "definitions" in defn["segments"]:
    defn["segments"] = {"active": defn["segments"].get("active", []), "create": [], "update": [], "delete": []}

defn.setdefault("title", defn.get("dynamicTitle", {}).get("text", [{}])[0].get("text", ""))
defn.setdefault("description", "")
defn.setdefault("noDateRange", False)
defn.pop("modified", None)
defn.pop("allowTableDrill", None)

# Make your changes
defn["charts"]["main"]["overrides"]["show_data_label"] = "Always"
defn["title"] = "Updated Title"
defn["dynamicTitle"]["text"][0]["text"] = "Updated Title"

with open("updated.json", "w") as f:
    json.dump({"definition": defn, "dataProvider": card["dataProvider"], "variables": True, "columns": False}, f, indent=2)
PYEOF

# Write back
community-domo-cli --output json -y cards update $CARD_ID --body-file updated.json
```

## Python Helper: Build Card Body

```python
import json

def build_card_body(
    dataset_id: str,
    chart_type: str,
    title: str,
    columns: list[dict],
    overrides: dict = None,
    description: str = "",
    filters: list = None,
):
    items = [c for c in columns if c.get("mapping") == "ITEM"]
    series = [c for c in columns if c.get("mapping") == "SERIES"]
    values = [c for c in columns if c.get("mapping") == "VALUE"]
    group_by = [{"column": c["column"]} for c in items + series if "column" in c]

    big_number_cols = []
    if chart_type != "badge_singlevalue" and values:
        v = values[0]
        bn = {"aggregation": v.get("aggregation", "SUM"), "alias": v.get("alias", v.get("column", ""))}
        bn["format"] = {"type": "abbreviated", "format": "#A"}
        if "column" in v:
            bn["column"] = v["column"]
        elif "formulaId" in v:
            bn["formulaId"] = v["formulaId"]
        big_number_cols.append(bn)

    return {
        "definition": {
            "subscriptions": {
                "big_number": {"name": "big_number", "columns": big_number_cols, "filters": []},
                "main": {
                    "name": "main", "columns": columns,
                    "filters": filters or [], "orderBy": [],
                    "groupBy": group_by, "fiscal": False,
                    "projection": False, "distinct": False,
                },
            },
            "formulas": {"dsUpdated": [], "dsDeleted": [], "card": []},
            "annotations": {"new": [], "modified": [], "deleted": []},
            "conditionalFormats": {"card": [], "datasource": []},
            "controls": [],
            "segments": {"active": [], "create": [], "update": [], "delete": []},
            "charts": {
                "main": {
                    "component": "main", "chartType": chart_type,
                    "overrides": overrides or {}, "goal": None,
                }
            },
            "dynamicTitle": {"text": [{"text": title, "type": "TEXT"}]},
            "dynamicDescription": {"text": [{"text": description, "type": "TEXT"}], "displayOnCardDetails": True},
            "chartVersion": "12", "inputTable": False,
            "noDateRange": False, "title": title, "description": description,
        },
        "dataProvider": {"dataSourceId": dataset_id},
        "variables": True,
        "columns": False,
    }


body = build_card_body(
    dataset_id="abc-123-def",
    chart_type="badge_vert_bar",
    title="Revenue by Team",
    columns=[
        {"column": "Team", "mapping": "ITEM"},
        {"column": "Revenue", "mapping": "VALUE", "aggregation": "SUM"},
    ],
    overrides={"show_data_label": "Always"},
)

with open("card.json", "w") as f:
    json.dump(body, f, indent=2)
```
