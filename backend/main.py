from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import json
import logging
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Optional, Dict, Any
import re
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust based on frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to validate file format
def validate_file_format(filename: str, allowed_extensions: List[str]) -> None:
    if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
        logger.error(f"Unsupported file type: {filename}")
        raise HTTPException(status_code=400, detail=f"File must be one of {', '.join(allowed_extensions)}")

# Helper function to read file based on its type
def read_file(content: bytes, filename: str, sheet_name: Optional[str] = None, validate_format: bool = False) -> Any:
    if not content:
        logger.error(f"File {filename} is empty or corrupt")
        raise HTTPException(status_code=400, detail=f"File {filename} is empty or corrupt")
    
    if filename.lower().endswith(('.xlsx', '.xls')):
        try:
            return pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, engine='openpyxl')
        except Exception as e:
            logger.error(f"Error reading Excel {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
    elif filename.lower().endswith('.csv'):
        try:
            if validate_format:
                text = content.decode('utf-8')
                if not text.strip() or ',' not in text:
                    logger.error(f"Invalid CSV format in {filename}")
                    raise HTTPException(status_code=400, detail=f"File {filename} is not a valid CSV")
            return pd.read_csv(io.BytesIO(content))
        except Exception as e:
            logger.error(f"Error reading CSV {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading CSV file: {str(e)}")
    elif filename.lower().endswith('.json'):
        try:
            data = json.loads(content)
            if not isinstance(data, list):
                logger.error(f"JSON {filename} must contain an array of objects")
                raise HTTPException(status_code=400, detail=f"JSON {filename} must contain an array of objects")
            if validate_format:
                if not all(isinstance(item, dict) for item in data):
                    logger.error(f"JSON {filename} contains non-object elements")
                    raise HTTPException(status_code=400, detail=f"JSON {filename} must contain an array of objects")
            return pd.DataFrame(data)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON format in {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"File {filename} is not a valid JSON")
        except Exception as e:
            logger.error(f"Error reading JSON {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading JSON file: {str(e)}")
    elif filename.lower().endswith('.xml'):
        try:
            tree = ET.parse(io.BytesIO(content))
            root = tree.getroot()
            data = []
            for record in root.findall('record'):
                row = {child.tag: child.text for child in record}
                data.append(row)
            if not data:
                logger.error(f"XML {filename} contains no valid records")
                raise HTTPException(status_code=400, detail="XML file contains no valid records")
            return pd.DataFrame(data)
        except ET.ParseError as e:
            logger.error(f"Invalid XML format in {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"File {filename} is not a valid XML")
        except Exception as e:
            logger.error(f"Error reading XML {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading XML file: {str(e)}")
    else:
        logger.error(f"Unsupported file format: {filename}")
        raise HTTPException(status_code=400, detail="Unsupported file format")
    if filename.lower().endswith(('.xlsx', '.xls')):
        try:
            return pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, engine='openpyxl')
        except Exception as e:
            logger.error(f"Error reading Excel {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
    elif filename.lower().endswith('.csv'):
        try:
            return pd.read_csv(io.BytesIO(content))
        except Exception as e:
            logger.error(f"Error reading CSV {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading CSV file: {str(e)}")
    elif filename.lower().endswith('.json'):
        try:
            data = json.loads(content)
            if not isinstance(data, list):
                logger.error(f"JSON {filename} must contain an array of objects")
                raise HTTPException(status_code=400, detail=f"JSON {filename} must contain an array of objects")
            return pd.DataFrame(data)
        except Exception as e:
            logger.error(f"Error reading JSON {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading JSON file: {str(e)}")
    elif filename.lower().endswith('.xml'):
        try:
            tree = ET.parse(io.BytesIO(content))
            root = tree.getroot()
            data = []
            for record in root.findall('record'):
                row = {child.tag: child.text for child in record}
                data.append(row)
            if not data:
                logger.error(f"XML {filename} contains no valid records")
                raise HTTPException(status_code=400, detail="XML file contains no valid records")
            return pd.DataFrame(data)
        except Exception as e:
            logger.error(f"Error reading XML {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error reading XML file: {str(e)}")
    else:
        logger.error(f"Unsupported file format: {filename}")
        raise HTTPException(status_code=400, detail="Unsupported file format")

# Helper function to write DataFrame to desired format
def write_file(df: pd.DataFrame, output_format: str, filename: str, password: Optional[str] = None) -> bytes:
    output = io.BytesIO()
    if output_format == 'excel':
        try:
            from openpyxl import Workbook
            from openpyxl.writer.excel import ExcelWriter
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Sheet1')
                if password:
                    workbook = writer.book
                    workbook.security.lockStructure = True
                    workbook.security.workbookPassword = password
        except Exception as e:
            logger.error(f"Error writing password-protected Excel {filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error writing Excel file: {str(e)}")
    elif output_format == 'csv':
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return output.getvalue().encode('utf-8')
    elif output_format == 'json':
        output.write(json.dumps(df.to_dict(orient='records'), indent=2).encode('utf-8'))
    elif output_format == 'xml':
        root = ET.Element("records")
        for _, row in df.iterrows():
            record = ET.SubElement(root, "record")
            for col, value in row.items():
                child = ET.SubElement(record, col)
                child.text = str(value) if value is not None else ""
        tree = ET.ElementTree(root)
        tree.write(output, encoding='utf-8', xml_declaration=True)
    else:
        logger.error(f"Unsupported output format: {output_format}")
        raise HTTPException(status_code=400, detail="Unsupported output format")
    output.seek(0)
    return output.getvalue()

# Helper function to clean DataFrame based on tasks
def clean_dataframe(df: pd.DataFrame, tasks: Dict[str, Any]) -> pd.DataFrame:
    try:
        if tasks.get('remove_empty_rows'):
            df = df.dropna(how='all')
        if tasks.get('remove_empty_columns'):
            df = df.dropna(axis=1, how='all')
        if tasks.get('remove_duplicates') and isinstance(tasks['remove_duplicates'], dict):
            columns = tasks['remove_duplicates'].get('columns', list(df.columns))
            invalid_cols = [col for col in columns if col not in df.columns]
            if invalid_cols:
                raise HTTPException(status_code=400, detail=f"Columns not found: {invalid_cols}")
            df = df.drop_duplicates(subset=columns, keep='first')
        if tasks.get('replace_nulls') and isinstance(tasks['replace_nulls'], dict):
            value = tasks['replace_nulls'].get('value', "")
            df = df.fillna(value)
        if tasks.get('trim_whitespace'):
            for col in df.select_dtypes(include=['object']).columns:
                df[col] = df[col].astype(str).str.strip()
        if tasks.get('standardize_columns') and isinstance(tasks['standardize_columns'], dict):
            format_type = tasks['standardize_columns'].get('format', 'lowercase_underscore')
            if format_type == 'lowercase_underscore':
                df.columns = [re.sub(r'\s+', '_', str(col).strip().lower()) for col in df.columns]
            elif format_type == 'lowercase':
                df.columns = [str(col).strip().lower() for col in df.columns]
        if tasks.get('change_data_types') and isinstance(tasks['change_data_types'], dict):
            for col, dtype in tasks['change_data_types'].items():
                if col not in df.columns:
                    raise HTTPException(status_code=400, detail=f"Column {col} not found")
                try:
                    if dtype == 'int':
                        df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
                    elif dtype == 'float':
                        df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
                    elif dtype == 'str':
                        df[col] = df[col].astype(str)
                    else:
                        raise HTTPException(status_code=400, detail=f"Unsupported data type: {dtype}")
                except Exception as e:
                    logger.error(f"Error converting {col} to {dtype}: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"Error converting {col} to {dtype}")
        if tasks.get('apply_formulas') and isinstance(tasks['apply_formulas'], dict):
            for new_col, formula in tasks['apply_formulas'].items():
                try:
                    if formula.startswith('uppercase('):
                        col = formula[9:-1]
                        if col not in df.columns:
                            raise HTTPException(status_code=400, detail=f"Column {col} not found")
                        df[new_col] = df[col].astype(str).str.upper()
                    elif re.match(r"^(\w+)\s*\*\s*(\d+)$", formula):
                        match = re.match(r"^(\w+)\s*\*\s*(\d+)$", formula)
                        col, multiplier = match.groups()
                        if col not in df.columns:
                            raise HTTPException(status_code=400, detail=f"Column {col} not found")
                        df[new_col] = pd.to_numeric(df[col], errors='coerce') * int(multiplier)
                    else:
                        raise HTTPException(status_code=400, detail=f"Unsupported formula: {formula}")
                except Exception as e:
                    logger.error(f"Error applying formula {formula}: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"Error applying formula {formula}")
        if tasks.get('normalize_dates') and isinstance(tasks['normalize_dates'], dict):
            col = tasks['normalize_dates'].get('column')
            output_format = tasks['normalize_dates'].get('format', '%Y-%m-%d')
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Date column {col} not found")
            try:
                df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime(output_format)
            except Exception as e:
                logger.error(f"Error normalizing dates in {col}: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Error normalizing dates in {col}")
        return df
    except Exception as e:
        logger.error(f"Error cleaning DataFrame: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error cleaning data: {str(e)}")

# Helper function to extract data based on tasks
def extract_data(df: pd.DataFrame, tasks: Dict[str, Any]) -> pd.DataFrame:
    try:
        if tasks.get('extract_rows_by_index') and isinstance(tasks['extract_rows_by_index'], dict):
            start = tasks['extract_rows_by_index'].get('start')
            end = tasks['extract_rows_by_index'].get('end')
            if start is None or end is None or start < 0 or end < start or end >= len(df):
                raise HTTPException(status_code=400, detail="Invalid row indices")
            df = df.iloc[start:end + 1]
        if tasks.get('extract_rows_by_condition') and isinstance(tasks['extract_rows_by_condition'], dict):
            condition = tasks['extract_rows_by_condition'].get('condition')
            if condition:
                try:
                    df = df.query(condition)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Invalid condition: {str(e)}")
        if tasks.get('extract_columns') and isinstance(tasks['extract_columns'], dict):
            columns = tasks['extract_columns'].get('columns')
            if columns:
                missing_cols = [col for col in columns if col not in df.columns]
                if missing_cols:
                    raise HTTPException(status_code=400, detail=f"Columns not found: {missing_cols}")
                df = df[columns]
        if tasks.get('apply_filter') and isinstance(tasks['apply_filter'], dict):
            condition = tasks['apply_filter'].get('condition')
            if condition:
                try:
                    df = df.query(condition)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Invalid filter condition: {str(e)}")
        return df
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error extracting data: {str(e)}")
    
def validate_schema(data: Any, filename: str, is_excel: bool = False) -> None:
    try:
        if is_excel:
            if not isinstance(data, dict):  # Expecting sheet_name: DataFrame dict
                raise HTTPException(status_code=400, detail="Invalid Excel data for schema validation")
            columns = [set(df.columns) for df in data.values() if not df.empty]
            if len(columns) > 1 and len(set(frozenset(cols) for cols in columns)) > 1:
                logger.error(f"Inconsistent schema across sheets in {filename}")
                raise HTTPException(status_code=400, detail=f"Inconsistent schema across sheets in {filename}")
        else:
            if not isinstance(data, list):  # Expecting list of DataFrames
                raise HTTPException(status_code=400, detail="Invalid data for schema validation")
            columns = [set(df.columns) for df in data if not df.empty]
            if len(columns) > 1 and len(set(frozenset(cols) for cols in columns)) > 1:
                logger.error(f"Inconsistent schema across files")
                raise HTTPException(status_code=400, detail="Inconsistent schema across files")
    except Exception as e:
        logger.error(f"Error validating schema for {filename}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error validating schema: {str(e)}")

# Endpoint to merge multiple files
@app.post("/merge")
async def merge_files(
    files: List[UploadFile] = File(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least two files are required for merging")

    first_file_ext = files[0].filename.lower().split('.')[-1]
    allowed_extensions = ['xlsx', 'xls', 'csv', 'json', 'xml']
    if first_file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {first_file_ext}")

    for file in files:
        validate_file_format(file.filename, allowed_extensions)
        if check_corrupt_empty and file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        if first_file_ext in ['xlsx', 'xls']:
            dfs = []
            for file in files:
                content = await file.read()
                excel_file = pd.ExcelFile(io.BytesIO(content))
                for sheet_name in excel_file.sheet_names:
                    df = read_file(content, file.filename, sheet_name=sheet_name, validate_format=validate_format)
                    if df.empty:
                        logger.warning(f"Sheet {sheet_name} in {file.filename} is empty, skipping")
                        continue
                    df.columns = [str(col).strip().lower() for col in df.columns]
                    df['source_file'] = file.filename
                    df['source_sheet'] = sheet_name
                    dfs.append(df)
            if validate_schema:
                validate_schema(dfs, "merged files", is_excel=False)
            combined_df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()
            if combined_df.empty:
                raise HTTPException(status_code=400, detail="No valid data found in uploaded Excel files")
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                combined_df.to_excel(writer, index=False, sheet_name='Merged')
                if password:
                    writer.book.security.lockStructure = True
                    writer.book.security.workbookPassword = password
            output.seek(0)
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=merged_excel.xlsx"}
            )
        elif first_file_ext == 'csv':
            dfs = []
            for file in files:
                content = await file.read()
                df = read_file(content, file.filename, validate_format=validate_format)
                if df.empty:
                    logger.warning(f"CSV {file.filename} is empty, skipping")
                    continue
                df.columns = [str(col).strip().lower() for col in df.columns]
                df['source_file'] = file.filename
                dfs.append(df)
            if validate_schema:
                validate_schema(dfs, "merged files", is_excel=False)
            combined_df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()
            if combined_df.empty:
                raise HTTPException(status_code=400, detail="No valid data found in uploaded CSV files")
            output = io.StringIO()
            combined_df.to_csv(output, index=False)
            output.seek(0)
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode('utf-8')),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=merged_csv.csv"}
            )
        elif first_file_ext == 'json':
            combined_data = []
            for file in files:
                content = await file.read()
                df = read_file(content, file.filename, validate_format=validate_format)
                data = json.loads(content)
                if not isinstance(data, list):
                    raise HTTPException(status_code=400, detail=f"JSON {file.filename} must contain an array of objects")
                for item in data:
                    item['source_file'] = file.filename
                combined_data.extend(data)
            if validate_schema:
                validate_schema([pd.DataFrame(combined_data)], "merged files", is_excel=False)
            if not combined_data:
                raise HTTPException(status_code=400, detail="No valid data found in uploaded JSON files")
            output = io.BytesIO()
            output.write(json.dumps(combined_data, indent=2).encode('utf-8'))
            output.seek(0)
            return StreamingResponse(
                output,
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=merged_json.json"}
            )
        elif first_file_ext == 'xml':
            dfs = []
            for file in files:
                content = await file.read()
                df = read_file(content, file.filename, validate_format=validate_format)
                if df.empty:
                    logger.warning(f"XML {file.filename} is empty, skipping")
                    continue
                df['source_file'] = file.filename
                dfs.append(df)
            if validate_schema:
                validate_schema(dfs, "merged files", is_excel=False)
            combined_df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()
            if combined_df.empty:
                raise HTTPException(status_code=400, detail="No valid data found in uploaded XML files")
            output = write_file(combined_df, 'xml', 'merged_output.xml')
            return StreamingResponse(
                io.BytesIO(output),
                media_type="application/xml",
                headers={"Content-Disposition": "attachment; filename=merged_xml.xml"}
            )
    except Exception as e:
        logger.error(f"Error merging files: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error merging files: {str(e)}")


# Endpoint to split a file
@app.post("/split")
async def split_file(
    files: List[UploadFile] = File(...),
    rows_per_file: int = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="Exactly one file must be provided for splitting")
    file = files[0]
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")
    if rows_per_file <= 0:
        raise HTTPException(status_code=400, detail="Rows per file must be greater than 0")

    validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
    content = await file.read()
    ext = file.filename.lower().split('.')[-1]

    try:
        output_zip = io.BytesIO()
        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
            if ext in ['xlsx', 'xls']:
                excel_file = pd.ExcelFile(io.BytesIO(content))
                if validate_schema:
                    data = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
                    validate_schema(data, file.filename, is_excel=True)
                for sheet_name in excel_file.sheet_names:
                    df = read_file(content, file.filename, sheet_name=sheet_name, validate_format=validate_format)
                    if df.empty:
                        logger.warning(f"Sheet {sheet_name} in {file.filename} is empty, skipping")
                        continue
                    total_rows = len(df)
                    for i in range(0, total_rows, rows_per_file):
                        chunk = df.iloc[i:i + rows_per_file]
                        chunk_output = io.BytesIO()
                        with pd.ExcelWriter(chunk_output, engine='openpyxl') as writer:
                            chunk.to_excel(writer, index=False, sheet_name='Sheet1')
                            if password:
                                writer.book.security.lockStructure = True
                                writer.book.security.workbookPassword = password
                        chunk_output.seek(0)
                        zf.writestr(f"split_{file.filename}_sheet_{sheet_name}_part_{i//rows_per_file + 1}.xlsx", chunk_output.getvalue())
            elif ext == 'csv':
                df = read_file(content, file.filename, validate_format=validate_format)
                if df.empty:
                    raise HTTPException(status_code=400, detail=f"CSV {file.filename} is empty")
                total_rows = len(df)
                for i in range(0, total_rows, rows_per_file):
                    chunk = df.iloc[i:i + rows_per_file]
                    chunk_output = io.StringIO()
                    chunk.to_csv(chunk_output, index=False)
                    chunk_output.seek(0)
                    zf.writestr(f"split_{file.filename}_part_{i//rows_per_file + 1}.csv", chunk_output.getvalue())
            elif ext == 'json':
                data = json.loads(content)
                if not isinstance(data, list):
                    raise HTTPException(status_code=400, detail=f"JSON {file.filename} must contain an array of objects")
                total_rows = len(data)
                for i in range(0, total_rows, rows_per_file):
                    chunk = data[i:i + rows_per_file]
                    chunk_output = io.BytesIO()
                    chunk_output.write(json.dumps(chunk, indent=2).encode('utf-8'))
                    chunk_output.seek(0)
                    zf.writestr(f"split_{file.filename}_part_{i//rows_per_file + 1}.json", chunk_output.getvalue())
            elif ext == 'xml':
                df = read_file(content, file.filename, validate_format=validate_format)
                if df.empty:
                    raise HTTPException(status_code=400, detail=f"XML {file.filename} is empty")
                total_rows = len(df)
                for i in range(0, total_rows, rows_per_file):
                    chunk = df.iloc[i:i + rows_per_file]
                    chunk_output = write_file(chunk, 'xml', f"split_part_{i//rows_per_file + 1}.xml")
                    zf.writestr(f"split_{file.filename}_part_{i//rows_per_file + 1}.xml", chunk_output)
        output_zip.seek(0)
        return StreamingResponse(
            output_zip,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=split_{file.filename}.zip"}
        )
    except Exception as e:
        logger.error(f"Error splitting file: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error splitting file: {str(e)}")

# Endpoint to convert file format
@app.post("/convert")
async def convert_file(
    file: UploadFile = File(...),
    input_format: str = Form(...),
    output_format: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
    valid_formats = ['excel', 'csv', 'json', 'xml']
    if input_format not in valid_formats or output_format not in valid_formats:
        raise HTTPException(status_code=400, detail="Invalid input or output format")
    if input_format == output_format:
        raise HTTPException(status_code=400, detail="Input and output formats must be different")

    input_ext = file.filename.lower().split('.')[-1]
    ext_map = {'excel': ['xlsx', 'xls'], 'csv': ['csv'], 'json': ['json'], 'xml': ['xml']}
    if input_ext not in ext_map[input_format]:
        raise HTTPException(status_code=400, detail=f"File extension {input_ext} does not match input format {input_format}")

    content = await file.read()
    if input_format == 'excel':
        data = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
        if validate_schema:
            validate_schema(data, file.filename, is_excel=True)
        df = pd.concat([df for df in data.values() if not df.empty], ignore_index=True) if data else pd.DataFrame()
    else:
        df = read_file(content, file.filename, validate_format=validate_format)
    if df.empty:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        output = write_file(df, output_format, file.filename, password=password if output_format == 'excel' else None)
        ext_map = {'excel': 'xlsx', 'csv': 'csv', 'json': 'json', 'xml': 'xml'}
        output_filename = f"converted_{file.filename.split('.')[0]}.{ext_map[output_format]}"
        return StreamingResponse(
            io.BytesIO(output),
            media_type={
                'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'csv': 'text/csv',
                'json': 'application/json',
                'xml': 'application/xml'
            }[output_format],
            headers={"Content-Disposition": f"attachment; filename={output_filename}"}
        )
    except Exception as e:
        logger.error(f"Error converting file: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error converting file: {str(e)}")

# Endpoint to clean a file
@app.post("/clean")
async def clean_file(
    file: UploadFile = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid tasks JSON")

    content = await file.read()
    if file.filename.lower().endswith(('.xlsx', '.xls')):
        data = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
        if validate_schema:
            validate_schema(data, file.filename, is_excel=True)
        df = pd.concat([df for df in data.values() if not df.empty], ignore_index=True) if data else pd.DataFrame()
    else:
        df = read_file(content, file.filename, validate_format=validate_format)
    if df.empty:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        cleaned_df = clean_dataframe(df, tasks_dict)
        output_format = 'excel' if file.filename.lower().endswith(('.xlsx', '.xls')) else file.filename.split('.')[-1]
        output = write_file(cleaned_df, output_format, file.filename, password=password if output_format == 'excel' else None)
        return StreamingResponse(
            io.BytesIO(output),
            media_type={
                'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'csv': 'text/csv',
                'json': 'application/json',
                'xml': 'application/xml'
            }[output_format],
            headers={"Content-Disposition": f"attachment; filename=cleaned_{file.filename}"}
        )
    except Exception as e:
        logger.error(f"Error cleaning file: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error cleaning file: {str(e)}")

# Endpoint to extract data from a spreadsheet
@app.post("/extract")
async def extract_data_endpoint(
    file: UploadFile = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid tasks JSON")

    content = await file.read()
    if file.filename.lower().endswith(('.xlsx', '.xls')):
        df_dict = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
        if validate_schema:
            validate_schema(df_dict, file.filename, is_excel=True)
        is_excel = True
    else:
        df = read_file(content, file.filename, validate_format=validate_format)
        is_excel = False

    try:
        if tasks_dict.get('extract_metadata'):
            if is_excel:
                sheet_names = list(df_dict.keys())
                first_sheet = df_dict[sheet_names[0]]
                row_count = len(first_sheet)
                column_count = len(first_sheet.columns)
            else:
                row_count = len(df)
                column_count = len(df.columns)
                sheet_names = ['Sheet1']
            return JSONResponse(content={
                'sheet_names': sheet_names,
                'row_count': row_count,
                'column_count': column_count
            })
        if is_excel and tasks_dict.get('extract_sheets') and isinstance(tasks_dict['extract_sheets'], dict):
            sheets = tasks_dict['extract_sheets'].get('sheets', [])
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                for sheet_name in sheets:
                    if sheet_name in df_dict:
                        df_dict[sheet_name].to_excel(writer, sheet_name=str(sheet_name), index=False)
                    elif sheet_name.isdigit() and int(sheet_name) < len(df_dict):
                        df_dict[list(df_dict.keys())[int(sheet_name)]].to_excel(writer, sheet_name=f"Sheet_{sheet_name}", index=False)
                    else:
                        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found")
                if password:
                    writer.book.security.lockStructure = True
                    writer.book.security.workbookPassword = password
            output.seek(0)
            return StreamingResponse(
                output,
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers={"Content-Disposition": f"attachment; filename=extracted_{file.filename}"}
            )
        sheet = list(df_dict.values())[0] if is_excel else df
        if sheet.empty:
            raise HTTPException(status_code=400, detail=f"Selected sheet in {file.filename} is empty")
        extracted_df = extract_data(sheet, tasks_dict)
        output_format = 'excel' if file.filename.lower().endswith(('.xlsx', '.xls')) else file.filename.split('.')[-1]
        output = write_file(extracted_df, output_format, file.filename, password=password if output_format == 'excel' else None)
        return StreamingResponse(
            io.BytesIO(output),
            media_type={
                'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'csv': 'text/csv',
                'json': 'application/json',
                'xml': 'application/xml'
            }[output_format],
            headers={"Content-Disposition": f"attachment; filename=extracted_{file.filename}"}
        )
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error extracting data: {str(e)}")

# Endpoint to combine multiple sheets into one
@app.post("/combine-sheets")
async def combine_sheets(
    file: UploadFile = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    validate_file_format(file.filename, ['.xlsx', '.xls'])
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON tasks format")

    if not tasks_dict.get('combine_sheets') or not isinstance(tasks_dict['combine_sheets'], dict) or not tasks_dict['combine_sheets'].get('target_sheet'):
        raise HTTPException(status_code=400, detail="Target sheet name is required")

    target_sheet = tasks_dict['combine_sheets']['target_sheet']
    content = await file.read()
    sheets = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
    if validate_schema:
        validate_schema(sheets, file.filename, is_excel=True)

    try:
        combined_df = pd.concat([df for df in sheets.values() if not df.empty], ignore_index=True)
        if combined_df.empty:
            raise HTTPException(status_code=400, detail="No valid data found in sheets")
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            combined_df.to_excel(writer, sheet_name=target_sheet, index=False)
            if password:
                writer.book.security.lockStructure = True
                writer.book.security.workbookPassword = password
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f"attachment; filename=combined_sheets_{file.filename}"}
        )
    except Exception as e:
        logger.error(f"Error combining sheets: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error combining sheets: {str(e)}")
    
# Endpoint to split a file into multiple sheets
@app.post("/split-to-sheets")
async def split_to_sheets(
    file: UploadFile = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    validate_file_format(file.filename, ['.xlsx', '.xls'])
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON tasks format")

    if not tasks_dict.get('split_to_sheets') or not isinstance(tasks_dict['split_to_sheets'], dict) or not tasks_dict['split_to_sheets'].get('rows_per_sheet'):
        raise HTTPException(status_code=400, detail="Rows per sheet is required")

    rows_per_sheet = tasks_dict['split_to_sheets']['rows_per_sheet']
    if rows_per_sheet <= 0:
        raise HTTPException(status_code=400, detail="Rows per sheet must be greater than 0")

    content = await file.read()
    sheets = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
    if validate_schema:
        validate_schema(sheets, file.filename, is_excel=True)
    df = pd.concat([df for df in sheets.values() if not df.empty], ignore_index=True)
    if df.empty:
        raise HTTPException(status_code=400, detail="No valid data found in sheets")

    try:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            total_rows = len(df)
            for i in range(0, total_rows, rows_per_sheet):
                chunk = df.iloc[i:i + rows_per_sheet]
                sheet_name = f"Sheet_{i//rows_per_sheet + 1}"
                chunk.to_excel(writer, sheet_name=sheet_name, index=False)
            if password:
                writer.book.security.lockStructure = True
                writer.book.security.workbookPassword = password
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f"attachment; filename=split_sheets_{file.filename}"}
        )
    except Exception as e:
        logger.error(f"Error splitting to sheets: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error splitting to sheets: {str(e)}")
    
# Endpoint to rename sheets
@app.post("/rename-sheets")
async def rename_sheets(
    file: UploadFile = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    validate_file_format(file.filename, ['.xlsx', '.xls'])
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON tasks format")

    if not tasks_dict.get('rename_sheets') or not isinstance(tasks_dict['rename_sheets'], dict) or not tasks_dict['rename_sheets'].get('sheet_names'):
        raise HTTPException(status_code=400, detail="Sheet names are required")

    new_names = tasks_dict['rename_sheets']['sheet_names']
    content = await file.read()
    sheets = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
    if validate_schema:
        validate_schema(sheets, file.filename, is_excel=True)

    try:
        if len(new_names) != len(sheets):
            raise HTTPException(status_code=400, detail="Number of new names must match number of sheets")
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for old_name, new_name in zip(sheets.keys(), new_names):
                if not new_name or len(new_name) > 31:
                    raise HTTPException(status_code=400, detail=f"Invalid sheet name: {new_name}")
                sheets[old_name].to_excel(writer, sheet_name=new_name, index=False)
            if password:
                writer.book.security.lockStructure = True
                writer.book.security.workbookPassword = password
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f"attachment; filename=renamed_sheets_{file.filename}"}
        )
    except Exception as e:
        logger.error(f"Error renaming sheets: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error renaming sheets: {str(e)}")

# Endpoint to reorder sheets
@app.post("/reorder-sheets")
async def reorder_sheets(
    file: UploadFile = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    validate_file_format(file.filename, ['.xlsx', '.xls'])
    if check_corrupt_empty and file.size == 0:
        raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON tasks format")

    if not tasks_dict.get('reorder_sheets') or not isinstance(tasks_dict['reorder_sheets'], dict) or not tasks_dict['reorder_sheets'].get('sheet_order'):
        raise HTTPException(status_code=400, detail="Sheet order is required")

    sheet_order = tasks_dict['reorder_sheets']['sheet_order']
    content = await file.read()
    sheets = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
    if validate_schema:
        validate_schema(sheets, file.filename, is_excel=True)

    try:
        valid_sheets = list(sheets.keys())
        ordered_sheets = []
        for sheet in sheet_order:
            if sheet in valid_sheets:
                ordered_sheets.append(sheet)
            elif isinstance(sheet, str) and sheet.isdigit() and int(sheet) < len(valid_sheets):
                ordered_sheets.append(valid_sheets[int(sheet)])
            else:
                raise HTTPException(status_code=400, detail=f"Invalid sheet name or index: {sheet}")
        if len(set(ordered_sheets)) != len(sheets):
            raise HTTPException(status_code=400, detail="Sheet order must include all sheets exactly once")
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for sheet_name in ordered_sheets:
                sheets[sheet_name].to_excel(writer, sheet_name=sheet_name, index=False)
            if password:
                writer.book.security.lockStructure = True
                writer.book.security.workbookPassword = password
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f"attachment; filename=reordered_sheets_{file.filename}"}
        )
    except Exception as e:
        logger.error(f"Error reordering sheets: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error reordering sheets: {str(e)}")

# Endpoint to copy sheets between Excel files
@app.post("/copy-sheets")
async def copy_sheets(
    files: List[UploadFile] = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if len(files) != 2:
        raise HTTPException(status_code=400, detail="Exactly two files required (source and target)")
    for file in files:
        validate_file_format(file.filename, ['.xlsx', '.xls'])
        if check_corrupt_empty and file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON tasks format")

    if not tasks_dict.get('copy_sheets') or not isinstance(tasks_dict['copy_sheets'], dict) or not tasks_dict['copy_sheets'].get('source_sheets'):
        raise HTTPException(status_code=400, detail="Source sheets are required")

    source_sheets = tasks_dict['copy_sheets']['source_sheets']
    source_content = await files[0].read()
    target_content = await files[1].read()
    source_sheets_dict = read_file(source_content, files[0].filename, sheet_name=None, validate_format=validate_format)
    target_sheets = read_file(target_content, files[1].filename, sheet_name=None, validate_format=validate_format)
    if validate_schema:
        validate_schema(source_sheets_dict, files[0].filename, is_excel=True)
        validate_schema(target_sheets, files[1].filename, is_excel=True)

    try:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for sheet_name, df in target_sheets.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)
            for sheet in source_sheets:
                if sheet in source_sheets_dict:
                    source_sheets_dict[sheet].to_excel(writer, sheet_name=sheet, index=False)
                elif isinstance(sheet, str) and sheet.isdigit() and int(sheet) < len(source_sheets_dict):
                    sheet_name = list(source_sheets_dict.keys())[int(sheet)]
                    source_sheets_dict[sheet_name].to_excel(writer, sheet_name=sheet_name, index=False)
                else:
                    raise HTTPException(status_code=400, detail=f"Invalid source sheet: {sheet}")
            if password:
                writer.book.security.lockStructure = True
                writer.book.security.workbookPassword = password
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f"attachment; filename=copied_sheets_{files[1].filename}"}
        )
    except Exception as e:
        logger.error(f"Error copying sheets: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error copying sheets: {str(e)}")

# Endpoint to bulk rename files
@app.post("/bulk-rename")
async def bulk_rename(
    files: List[UploadFile] = File(...),
    rename_pattern: str = Form(...),
    validate_format: bool = Form(False),
    check_corrupt_empty: bool = Form(False)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if not rename_pattern:
        raise HTTPException(status_code=400, detail="Rename pattern is required")

    for file in files:
        validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
        if check_corrupt_empty and file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    output = io.BytesIO()
    try:
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for i, file in enumerate(files):
                content = await file.read()
                if validate_format:
                    read_file(content, file.filename, validate_format=True)  # Validate format without processing
                ext = file.filename.split('.')[-1]
                base_name = file.filename[:file.filename.rfind('.')]
                new_filename = rename_pattern.format(index=i, filename=base_name) + f".{ext}"
                if not re.match(r'^[\w\-\_\.]+$', new_filename):
                    raise HTTPException(status_code=400, detail=f"Invalid characters in filename: {new_filename}")
                zf.writestr(new_filename, content)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/zip',
            headers={"Content-Disposition": "attachment; filename=renamed_files.zip"}
        )
    except Exception as e:
        logger.error(f"Error renaming files: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error renaming files: {str(e)}")

# Endpoint to bulk compress files
@app.post("/bulk-compress")
async def bulk_compress(
    files: List[UploadFile] = File(...),
    validate_format: bool = Form(False),
    check_corrupt_empty: bool = Form(False)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    for file in files:
        validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
        if check_corrupt_empty and file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    output = io.BytesIO()
    try:
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file in files:
                content = await file.read()
                if validate_format:
                    read_file(content, file.filename, validate_format=True)  # Validate format without processing
                zf.writestr(file.filename, content)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/zip',
            headers={"Content-Disposition": "attachment; filename=compressed_files.zip"}
        )
    except Exception as e:
        logger.error(f"Error compressing files: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error compressing files: {str(e)}")

# Endpoint to batch convert files
@app.post("/batch-convert")
async def batch_convert(files: List[UploadFile] = File(...), input_format: str = Form(...), output_format: str = Form(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    valid_formats = ['excel', 'csv', 'json', 'xml']
    if input_format not in valid_formats or output_format not in valid_formats:
        raise HTTPException(status_code=400, detail="Invalid input or output format")
    if input_format == output_format:
        raise HTTPException(status_code=400, detail="Input and output formats must be different")

    for file in files:
        validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
        if file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    output = io.BytesIO()
    try:
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_idx, file in enumerate(files):
                content = await file.read()
                df = read_file(content, file.filename)
                if df.empty:
                    logger.warning(f"File {file.filename} is empty, skipping")
                    continue
                ext_map = {'excel': 'xlsx', 'csv': 'csv', 'json': 'json', 'xml': 'xml'}
                new_filename = f"converted_{file_idx}.{ext_map[output_format]}"
                converted_data = write_file(df, output_format, new_filename)
                zf.writestr(new_filename, converted_data)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/zip',
            headers={"Content-Disposition": "attachment; filename=batch_converted_files.zip"}
        )
    except Exception as e:
        logger.error(f"Error batch converting files: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error batch converting files: {str(e)}")@app.post("/batch-convert")
async def batch_convert(
    files: List[UploadFile] = File(...),
    input_format: str = Form(...),
    output_format: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    valid_formats = ['excel', 'csv', 'json', 'xml']
    if input_format not in valid_formats or output_format not in valid_formats:
        raise HTTPException(status_code=400, detail="Invalid input or output format")
    if input_format == output_format:
        raise HTTPException(status_code=400, detail="Input and output formats must be different")

    for file in files:
        validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
        if check_corrupt_empty and file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    output = io.BytesIO()
    try:
        dfs = []
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_idx, file in enumerate(files):
                content = await file.read()
                if input_format == 'excel':
                    data = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
                    if validate_schema:
                        validate_schema(data, file.filename, is_excel=True)
                    df = pd.concat([df for df in data.values() if not df.empty], ignore_index=True) if data else pd.DataFrame()
                else:
                    df = read_file(content, file.filename, validate_format=validate_format)
                if df.empty:
                    logger.warning(f"File {file.filename} is empty, skipping")
                    continue
                dfs.append(df)
                ext_map = {'excel': 'xlsx', 'csv': 'csv', 'json': 'json', 'xml': 'xml'}
                new_filename = f"converted_{file_idx}.{ext_map[output_format]}"
                converted_data = write_file(df, output_format, new_filename, password=password if output_format == 'excel' else None)
                zf.writestr(new_filename, converted_data)
        if validate_schema and dfs:
            validate_schema(dfs, "batch converted files", is_excel=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/zip',
            headers={"Content-Disposition": "attachment; filename=batch_converted_files.zip"}
        )
    except Exception as e:
        logger.error(f"Error batch converting files: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error batch converting files: {str(e)}")

# Endpoint to batch clean files
@app.post("/batch-clean")
async def batch_clean(
    files: List[UploadFile] = File(...),
    tasks: str = Form(...),
    validate_schema: bool = Form(False),
    validate_format: bool = Form(False),
    password: Optional[str] = Form(None),
    check_corrupt_empty: bool = Form(False)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    try:
        tasks_dict = json.loads(tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON tasks format")

    for file in files:
        validate_file_format(file.filename, ['.xlsx', '.xls', '.csv', '.json', '.xml'])
        if check_corrupt_empty and file.size == 0:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")

    output = io.BytesIO()
    try:
        dfs = []
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_idx, file in enumerate(files):
                content = await file.read()
                if file.filename.lower().endswith(('.xlsx', '.xls')):
                    data = read_file(content, file.filename, sheet_name=None, validate_format=validate_format)
                    if validate_schema:
                        validate_schema(data, file.filename, is_excel=True)
                    df = pd.concat([df for df in data.values() if not df.empty], ignore_index=True) if data else pd.DataFrame()
                else:
                    df = read_file(content, file.filename, validate_format=validate_format)
                if df.empty:
                    logger.warning(f"File {file.filename} is empty, skipping")
                    continue
                cleaned_df = clean_dataframe(df, tasks_dict)
                dfs.append(cleaned_df)
                ext = file.filename.split('.')[-1]
                output_format = 'excel' if ext in ['xlsx', 'xls'] else ext
                new_filename = f"cleaned_{file_idx}.{ext}"
                cleaned_data = write_file(cleaned_df, output_format, new_filename, password=password if output_format == 'excel' else None)
                zf.writestr(new_filename, cleaned_data)
        if validate_schema and dfs:
            validate_schema(dfs, "batch cleaned files", is_excel=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type='application/zip',
            headers={"Content-Disposition": "attachment; filename=batch_cleaned_files.zip"}
        )
    except Exception as e:
        logger.error(f"Error batch cleaning files: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error batch cleaning files: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)