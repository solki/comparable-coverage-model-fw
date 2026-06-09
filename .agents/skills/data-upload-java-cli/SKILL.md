---
name: data-upload-java-cli
description: Java CLI (domoutil.jar) fallback for CSV upload to Domo; schema derivation, chunked uploads. Use when JSON connector is not suitable.
---

# Domo Data Upload Guide

> **Preferred Strategy — JSON Connector first, CLI fallback:**
> When the data source is a REST/JSON API, always try the **Domo JSON No-Code Connector** (`domo-json-no-code-connector` skill) first. It creates a live, re-runnable connector stream inside Domo so data can be refreshed from the UI without re-running scripts.
> Only fall back to the Java CLI when:
> - The JSON connector fails (auth issues, unsupported pagination, parsing errors), or
> - The data is already in CSV form (local files, database exports, etc.) and there is no source API to connect to.

## Overview

This guide covers the **Java CLI fallback** for uploading CSV data to Domo using `domoutil.jar`. The CLI handles schema derivation, dataset creation, chunked uploads, and indexing automatically.


## JSON Connector First / CLI Fallback Pattern

When pulling from a REST/JSON API into Domo, use this two-path strategy in code:

```python
def ingest_object(obj_type, cfg):
    # Path 1 — JSON No-Code Connector (creates a live stream in Domo)
    ok, dataset_id = try_json_connector(obj_type, cfg)

    # Path 2 — CLI fallback (fetch → CSV → upload)
    if not ok:
        ok, dataset_id = try_cli_fallback(obj_type, cfg, work_dir)
```

**Path 1 (JSON connector)** steps:
1. `POST /api/data/v1/accounts` — create a `json5` account for auth
2. `POST /api/data/v1/streams` — configure URL, headers, parsing, paging
3. `POST /api/data/v1/streams/{id}/executions` — trigger a run
4. Poll `GET /api/data/v1/streams/{id}/executions/{execId}` until `currentState` is `"SUCCESS"` or `"ERROR"`
5. If `"ERROR"` or HTTP error at any step → fall through to Path 2

**Path 2 (CLI fallback)** steps:
1. Fetch all pages from the source API using `requests`
2. Write records to a CSV file
3. `derive-schema` → build schema JSON
4. `create-dataset` → get dataset UUID
5. `upload-dataset -h` → upload CSV

**When to skip directly to CLI:**
- Data is already CSV (no source API)
- Source API is not JSON/REST (SOAP, binary, etc.)
- You've already confirmed the JSON connector can't handle the source's pagination

**Auth note for the JSON connector:** Use `credentialsType: "fields"` with `authentication: "none"` and inject the Authorization header directly in `jsonSelection.httpsHeaders`. Do **not** use `authType` — it is not valid for `json5` and returns a 400.

## Java CLI (Fallback Path)

- **CLI Location:** `/Users/elliottleonard/Documents/Cursor/CLI/domoutil.jar`
- **Run command:** `java -jar /Users/elliottleonard/Documents/Cursor/CLI/domoutil.jar`

## Prerequisites

- Java installed
- A Domo access token (format: `DDCI...`)
- A Domo instance URL (e.g., `instance.domo.com`)
- CSV file(s) to upload (RFC 4180-compliant)

## Quick Reference

### Connection

```
connect -server <instance>.domo.com -token <API_TOKEN>
```

Verify with `whoami`.

## Complete Workflow

### Step 1: Derive Schema from CSV

```
derive-schema -d /path/to/data.csv -r 500
```

- `-d`: Path to the CSV file
- `-r`: Number of rows to sample for type detection (500 is a good default)
- Returns column names and detected types: `STRING`, `LONG`, `DOUBLE`, `DATETIME`, etc.

**Output format:**
```
Schema:
  column_name1         STRING
  column_name2         LONG
  column_name3         DATETIME
```

### Step 2: Create a Schema JSON File

Convert the `derive-schema` output into a JSON schema file:

```json
{
  "columns": [
    {
      "name": "column_name1",
      "type": "STRING",
      "metadata": null,
      "upsertKey": false
    },
    {
      "name": "column_name2",
      "type": "LONG",
      "metadata": null,
      "upsertKey": false
    },
    {
      "name": "column_name3",
      "type": "DATETIME",
      "metadata": null,
      "upsertKey": false
    }
  ],
  "objects": []
}
```

**Valid column types:** `STRING`, `LONG`, `DOUBLE`, `DECIMAL`, `DATETIME`, `DATE`

### Step 3: Create the Dataset in Domo

```
create-dataset -n "<Dataset Name>" -t "<type>" -s /path/to/schema.json
```

- `-n`: Dataset name (displayed in Domo)
- `-t`: Dataset type (use `"domo-cli"` as a general-purpose type)
- `-s`: Path to the schema JSON file

**Output:**
```
Created DataSet: <dataset-uuid>
```

Save this UUID — you need it for the upload step.

### Step 4: Upload CSV Data

```
upload-dataset -i <dataset-uuid> -f /path/to/data.csv -h
```

- `-i` / `--id`: Dataset UUID from the create step
- `-f` / `--data`: Path to the CSV file
- `-h` / `--headers`: **Required when the CSV has a header row** (skips the first row)

**Output on success:**
```
Started upload for DataSet <uuid>.
Finished upload for DataSet <uuid>. Bytes sent X.
Started indexing for dataset <uuid>
Finished indexing for dataset <uuid> with status SUCCESS
Data uploaded successfully
```

### Upload Options

| Flag | Description |
|---|---|
| `-i <ID>` | Dataset UUID (required) |
| `-f <FILE>` | CSV file path |
| `-h` | CSV has a header row |
| `-a` / `--append` | Append to existing data instead of replacing |
| `-d <DIR>` | Upload all CSVs in a directory (files should NOT include headers) |
| `-c` | Files are gzipped (only with `-d`) |
| `-p <TAG>` | Partition tag (only with `--append`) |
| `-m <N>` | Max upload threads |
| `-x` | Skip indexing after upload |

## Scripted / Non-Interactive Mode

Pipe commands via stdin for automation:

```bash
echo -e "connect -server instance.domo.com -token YOUR_TOKEN\nupload-dataset -i <uuid> -f data.csv -h\nquit" \
  | java -jar /Users/elliottleonard/Documents/Cursor/CLI/domoutil.jar
```

Always end with `quit` to ensure clean exit.

## Batch Upload: Multiple CSVs

### Python Script Pattern

This is the recommended approach for uploading multiple CSV files at once. The script:
1. Derives schemas for each CSV
2. Creates schema JSON files
3. Creates datasets in Domo
4. Uploads the CSV data

```python
import subprocess, json, os, re

csv_dir = "/path/to/csv/directory"
cli = "/Users/elliottleonard/Documents/Cursor/CLI/domoutil.jar"
server = "instance.domo.com"
token = "DDCI..."
schema_dir = "/tmp/domo_schemas"
os.makedirs(schema_dir, exist_ok=True)

csvs = sorted([f for f in os.listdir(csv_dir) if f.endswith('.csv')])

# --- Phase 1: Derive schemas and save as JSON ---
for csv_file in csvs:
    csv_path = os.path.join(csv_dir, csv_file)
    cmds = f"connect -server {server} -token {token}\nderive-schema -d {csv_path} -r 500\nquit"
    result = subprocess.run(['java', '-jar', cli], input=cmds, capture_output=True, text=True, timeout=60)

    columns = []
    in_schema = False
    for line in result.stdout.split('\n'):
        if 'Schema:' in line:
            in_schema = True
            continue
        if in_schema and line.startswith('  ') and line.strip():
            parts = line.split()
            if len(parts) >= 2:
                col_type = parts[-1]
                col_name = ' '.join(parts[:-1]).strip()
                columns.append({"name": col_name, "type": col_type, "metadata": None, "upsertKey": False})
        elif in_schema and line.startswith('>'):
            in_schema = False

    schema = {"columns": columns, "objects": []}
    schema_path = os.path.join(schema_dir, csv_file.replace('.csv', '.json'))
    with open(schema_path, 'w') as f:
        json.dump(schema, f, indent=2)

# --- Phase 2: Create datasets ---
cmds = [f"connect -server {server} -token {token}"]
for csv_file in csvs:
    schema_path = os.path.join(schema_dir, csv_file.replace('.csv', '.json'))
    # Generate a friendly name from the filename
    friendly_name = csv_file.replace('.csv', '').split('.')[-1].replace('_', ' ').title()
    cmds.append(f'create-dataset -n "{friendly_name}" -t "domo-cli" -s {schema_path}')
cmds.append("quit")

result = subprocess.run(['java', '-jar', cli], input='\n'.join(cmds), capture_output=True, text=True, timeout=120)

# Parse dataset IDs from output
dataset_ids = []
for line in result.stdout.split('\n'):
    match = re.search(r'Created DataSet: ([0-9a-f-]{36})', line)
    if match:
        dataset_ids.append(match.group(1))

# --- Phase 3: Upload data ---
cmds = [f"connect -server {server} -token {token}"]
for csv_file, dataset_id in zip(csvs, dataset_ids):
    csv_path = os.path.join(csv_dir, csv_file)
    cmds.append(f'upload-dataset -i {dataset_id} -f {csv_path} -h')
cmds.append("quit")

result = subprocess.run(['java', '-jar', cli], input='\n'.join(cmds), capture_output=True, text=True, timeout=600)
print(result.stdout)
```

### Shell-Only Pattern

For simpler cases, use a shell script:

```bash
CLI="/Users/elliottleonard/Documents/Cursor/CLI/domoutil.jar"
SERVER="instance.domo.com"
TOKEN="DDCI..."

# Create commands file
cat > /tmp/upload_cmds.txt << EOF
connect -server $SERVER -token $TOKEN
upload-dataset -i <dataset-id-1> -f /path/to/file1.csv -h
upload-dataset -i <dataset-id-2> -f /path/to/file2.csv -h
quit
EOF

cat /tmp/upload_cmds.txt | java -jar "$CLI"
```

## Replacing Data in an Existing Dataset

To replace all data in an existing dataset (not append), use the same `upload-dataset` command without `--append`:

```
upload-dataset -i <existing-dataset-uuid> -f /path/to/new_data.csv -h
```

This performs a **full replace** — all existing rows are removed and replaced with the new CSV data.

## Appending Data

To add rows to an existing dataset without removing existing data:

```
upload-dataset -i <dataset-uuid> -f /path/to/new_rows.csv -h --append
```

## Common Pitfalls

### 1. Missing `-h` Flag
If your CSV has a header row and you forget `-h`, the header row will be imported as data. Always use `-h` for CSVs with headers.

### 2. `upload-dataset` Requires an Existing Dataset
The `upload-dataset` command does NOT create a dataset. You must first `create-dataset` with a schema file, then `upload-dataset` with the returned UUID. Uploading without a valid `--id` results in:
```
Executing POST: https://.../datasources/null/uploads
An error occurred while uploading the data from file
```

### 3. Schema Column Names Must Match CSV Headers
The column names in the schema JSON must match the CSV header names exactly (case-sensitive). Use `derive-schema` to auto-detect them.

### 4. `-t` Flag is Required for `create-dataset`
The dataset type (`-t`) is required. Use `"domo-cli"` as a safe default:
```
create-dataset -n "My Dataset" -t "domo-cli" -s schema.json
```

### 5. Large Files Are Auto-Split
Files over ~10MB are automatically split into multiple upload parts. The CLI handles this transparently. For very large uploads, consider using `-m` to control thread count.

### 6. derive-schema First Column Parsing
The `derive-schema` output can sometimes concatenate the first column name with preceding text. Always verify the first column name against your CSV header.

### 7. Directory Uploads Expect No Headers
When using `-d` (directory upload), the CSV files should NOT contain header rows. This mode is designed for pre-split partitioned data.

## Verifying Uploads

After uploading, verify data is accessible:

```
query-data -id <dataset-uuid> -q "SELECT * FROM table LIMIT 10"
```

Or check dataset metadata:

```
get-dataset -id <dataset-uuid>
get-schema -id <dataset-uuid>
```
