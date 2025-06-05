'use client';

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [operation, setOperation] = useState<
    'merge' | 'split' | 'convert' | 'clean' | 'extract' | 
    'combine-sheets' | 'split-to-sheets' | 'rename-sheets' | 'reorder-sheets' | 'copy-sheets' | 
    'bulk-rename' | 'bulk-compress' | 'batch-convert' | 'batch-clean'
  >('merge');
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rowsPerFile, setRowsPerFile] = useState<number | null>(null);
  const [inputFormat, setInputFormat] = useState<string>('excel');
  const [outputFormat, setOutputFormat] = useState<string>('csv');
  const [cleanTasks, setCleanTasks] = useState({
    remove_empty_rows: false,
    remove_empty_columns: false,
    remove_duplicates: false,
    duplicate_columns: '',
    replace_nulls: false,
    null_value: '',
    trim_whitespace: false,
    standardize_columns: false,
    column_format: 'lowercase_underscore',
    change_data_types: false,
    data_types: { column: '', type: 'int' },
    apply_formulas: false,
    formulas: { new_column: '', formula: '' },
    normalize_dates: false,
    date_column: '',
    date_format: '%Y-%m-%d',
  });
  const [extractTasks, setExtractTasks] = useState({
    extract_rows_by_index: false,
    row_start: '',
    row_end: '',
    extract_rows_by_condition: false,
    row_condition: '',
    extract_columns: false,
    columns: '',
    apply_filter: false,
    filter_condition: '',
    extract_sheets: false,
    sheets: '',
    extract_metadata: false,
    metadata: null as { sheet_names: string[]; row_count: number; column_count: number } | null,
  });
  const [sheetTasks, setSheetTasks] = useState({
    combine_sheets: false,
    target_sheet: 'Combined',
    split_to_sheets: false,
    rows_per_sheet: null as number | null,
    rename_sheets: false,
    sheet_names: '' as string,
    reorder_sheets: false,
    sheet_order: '' as string,
    copy_sheets: false,
    source_sheets: '' as string,
  });
  const [bulkTasks, setBulkTasks] = useState({
    rename_pattern: '' as string,
    compress_files: false,
    batch_input_format: 'excel' as string,
    batch_output_format: 'csv' as string,
    batch_clean_tasks: false,
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [validationSettings, setValidationSettings] = useState({
  validateSchema: false,
  validateFormat: true,
  passwordProtect: false,
  password: '',
  checkCorruptEmpty: true,
});

const validateFiles = (fileList: FileList | null): string | null => {
  if (!fileList || fileList.length === 0) return 'No files provided.';
  
  for (const file of Array.from(fileList)) {
    if (validationSettings.checkCorruptEmpty && file.size === 0) {
      return `File "${file.name}" is empty.`;
    }
    if (validationSettings.validateFormat && ['.json', '.csv'].some(ext => file.name.toLowerCase().endsWith(ext))) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (file.name.toLowerCase().endsWith('.json')) {
            try {
              JSON.parse(text);
            } catch {
              resolve(`File "${file.name}" is not a valid JSON.`);
              return;
            }
          } else if (file.name.toLowerCase().endsWith('.csv')) {
            if (!text.trim() || !text.includes(',')) {
              resolve(`File "${file.name}" is not a valid CSV.`);
              return;
            }
          }
          resolve(null);
        };
        reader.onerror = () => resolve(`File "${file.name}" appears corrupt.`);
        reader.readAsText(file);
      }).then((error) => error) as any;
    }
  }
  return null;
};


const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const fileList = e.target.files;
  const error = await validateFiles(fileList);
  if (error) {
    setError(error);
    setFiles(null);
    return;
  }
  setFiles(fileList);
  setError(null);
  if (extractTasks.extract_metadata && fileList) {
    handleMetadataExtraction(fileList);
  }
};

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  const droppedFiles = e.dataTransfer.files;
  if (['split', 'convert', 'clean', 'extract', 'combine-sheets', 'split-to-sheets', 'rename-sheets', 'reorder-sheets'].includes(operation) && droppedFiles.length > 1) {
    setError('Please drop only one file for this operation.');
    setFiles(null);
    return;
  }
  const error = await validateFiles(droppedFiles);
  if (error) {
    setError(error);
    setFiles(null);
    return;
  }
  if (droppedFiles.length > 0) {
    setFiles(droppedFiles);
    setError(null);
    if (extractTasks.extract_metadata) {
      handleMetadataExtraction(droppedFiles);
    }
  }
};


  const handleMetadataExtraction = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    formData.append('file', fileList[0]);
    formData.append('tasks', JSON.stringify({ extract_metadata: true }));

    try {
      const response = await axios.post('http://localhost:8000/extract', formData);
      setExtractTasks({ ...extractTasks, metadata: response.data });
    } catch (err: any) {
      setError('Error extracting metadata: ' + (err.response?.data?.detail || err.message));
    }
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!files || files.length === 0) {
    setError('Please select or drop at least one file.');
    return;
  }

  if (validationSettings.passwordProtect && !validationSettings.password) {
    setError('Please provide a password for Excel protection.');
    return;
  }
  if (validationSettings.passwordProtect && ['convert', 'combine-sheets', 'split-to-sheets', 'rename-sheets', 'reorder-sheets', 'copy-sheets', 'batch-convert'].includes(operation) && !['excel'].includes(outputFormat || bulkTasks.batch_output_format)) {
    setError('Password protection is only available for Excel outputs.');
    return;
  }

  if (['split', 'convert', 'clean', 'extract', 'combine-sheets', 'split-to-sheets', 'rename-sheets', 'reorder-sheets'].includes(operation) && files.length > 1) {
    setError('Please select or drop only one file for this operation.');
    return;
  }
  if (operation === 'split' && (rowsPerFile === null || rowsPerFile <= 0)) {
    setError('Please enter a valid number of rows per file (greater than 0).');
    return;
  }
  if (operation === 'convert' && inputFormat === outputFormat) {
    setError('Input and output formats must be different.');
    return;
  }
  if (operation === 'clean') {
    if (cleanTasks.remove_duplicates && !cleanTasks.duplicate_columns) {
      setError('Please specify columns for removing duplicates (comma-separated).');
      return;
    }
    if (cleanTasks.change_data_types && !cleanTasks.data_types.column) {
      setError('Please specify a column for data type change.');
      return;
    }
    if (cleanTasks.apply_formulas && (!cleanTasks.formulas.new_column || !cleanTasks.formulas.formula)) {
      setError('Please specify new column name and formula.');
      return;
    }
    if (cleanTasks.normalize_dates && !cleanTasks.date_column) {
      setError('Please specify a date column.');
      return;
    }
  }
  if (operation === 'extract') {
    if (
      !extractTasks.extract_rows_by_index &&
      !extractTasks.extract_rows_by_condition &&
      !extractTasks.extract_columns &&
      !extractTasks.apply_filter &&
      !extractTasks.extract_sheets &&
      !extractTasks.extract_metadata
    ) {
      setError('Please select at least one extraction or filtering task.');
      return;
    }
    if (extractTasks.extract_rows_by_index && (!extractTasks.row_start || !extractTasks.row_end)) {
      setError('Please specify both start and end row indices.');
      return;
    }
    if (extractTasks.extract_rows_by_condition && !extractTasks.row_condition) {
      setError('Please specify a condition for row extraction.');
      return;
    }
    if (extractTasks.extract_columns && !extractTasks.columns) {
      setError('Please specify columns to extract.');
      return;
    }
    if (extractTasks.apply_filter && !extractTasks.filter_condition) {
      setError('Please specify a filter condition.');
      return;
    }
    if (extractTasks.extract_sheets && !extractTasks.sheets) {
      setError('Please specify sheets to extract.');
      return;
    }
  }
  if (operation === 'combine-sheets' && !sheetTasks.target_sheet) {
    setError('Please specify a target sheet name.');
    return;
  }
  if (operation === 'split-to-sheets' && (sheetTasks.rows_per_sheet === null || sheetTasks.rows_per_sheet <= 0)) {
    setError('Please enter a valid number of rows per sheet (greater than 0).');
    return;
  }
  if (operation === 'rename-sheets' && !sheetTasks.sheet_names) {
    setError('Please specify new sheet names (comma-separated).');
    return;
  }
  if (operation === 'reorder-sheets' && !sheetTasks.sheet_order) {
    setError('Please specify the sheet order (comma-separated names or indices).');
    return;
  }
  if (operation === 'copy-sheets' && (!sheetTasks.source_sheets || files.length < 2)) {
    setError('Please specify source sheets and upload at least two files for copying.');
    return;
  }
  if (operation === 'bulk-rename' && !bulkTasks.rename_pattern) {
    setError('Please specify a rename pattern.');
    return;
  }
  if (operation === 'batch-convert' && bulkTasks.batch_input_format === bulkTasks.batch_output_format) {
    setError('Batch input and output formats must be different.');
    return;
  }
  if (operation === 'batch-clean' && !bulkTasks.batch_clean_tasks) {
    setError('Please enable batch cleaning tasks.');
    return;
  }

  setLoading(true);
  const formData = new FormData();
  Array.from(files).forEach((file, index) => {
    formData.append(
      ['merge', 'bulk-rename', 'bulk-compress', 'batch-convert', 'batch-clean'].includes(operation) ? 'files' : 'file',
      file
    );
  });
  formData.append('validate_schema', validationSettings.validateSchema.toString());
  formData.append('validate_format', validationSettings.validateFormat.toString());
  if (validationSettings.passwordProtect && validationSettings.password) {
    formData.append('password', validationSettings.password);
  }
  formData.append('check_corrupt_empty', validationSettings.checkCorruptEmpty.toString());

  if (operation === 'split' && rowsPerFile !== null) {
    formData.append('rows_per_file', rowsPerFile.toString());
  }
  if (operation === 'convert') {
    formData.append('input_format', inputFormat);
    formData.append('output_format', outputFormat);
  }
  if (operation === 'clean') {
    const tasks = {
      remove_empty_rows: cleanTasks.remove_empty_rows,
      remove_empty_columns: cleanTasks.remove_empty_columns,
      remove_duplicates: cleanTasks.remove_duplicates
        ? { columns: cleanTasks.duplicate_columns.split(',').map(col => col.trim()) }
        : false,
      replace_nulls: cleanTasks.replace_nulls ? { value: cleanTasks.null_value } : false,
      trim_whitespace: cleanTasks.trim_whitespace,
      standardize_columns: cleanTasks.standardize_columns ? { format: cleanTasks.column_format } : false,
      change_data_types: cleanTasks.change_data_types
        ? { [cleanTasks.data_types.column]: cleanTasks.data_types.type }
        : false,
      apply_formulas: cleanTasks.apply_formulas
        ? { [cleanTasks.formulas.new_column]: cleanTasks.formulas.formula }
        : false,
      normalize_dates: cleanTasks.normalize_dates
        ? { column: cleanTasks.date_column, format: cleanTasks.date_format }
        : false,
    };
    formData.append('tasks', JSON.stringify(tasks));
  }
  if (operation === 'extract') {
    const tasks = {
      extract_rows_by_index: extractTasks.extract_rows_by_index
        ? { start: parseInt(extractTasks.row_start), end: parseInt(extractTasks.row_end) }
        : false,
      extract_rows_by_condition: extractTasks.extract_rows_by_condition
        ? { condition: extractTasks.row_condition }
        : false,
      extract_columns: extractTasks.extract_columns
        ? { columns: extractTasks.columns.split(',').map(col => col.trim()) }
        : false,
      apply_filter: extractTasks.apply_filter ? { condition: extractTasks.filter_condition } : false,
      extract_sheets: extractTasks.extract_sheets
        ? { sheets: extractTasks.sheets.split(',').map(sheet => sheet.trim()) }
        : false,
      extract_metadata: extractTasks.extract_metadata,
    };
    formData.append('tasks', JSON.stringify(tasks));
  }
  if (['combine-sheets', 'split-to-sheets', 'rename-sheets', 'reorder-sheets', 'copy-sheets'].includes(operation)) {
    const tasks = {
      combine_sheets: sheetTasks.combine_sheets ? { target_sheet: sheetTasks.target_sheet } : false,
      split_to_sheets: sheetTasks.split_to_sheets ? { rows_per_sheet: sheetTasks.rows_per_sheet } : false,
      rename_sheets: sheetTasks.rename_sheets ? { sheet_names: sheetTasks.sheet_names.split(',').map(name => name.trim()) } : false,
      reorder_sheets: sheetTasks.reorder_sheets ? { sheet_order: sheetTasks.sheet_order.split(',').map(order => order.trim()) } : false,
      copy_sheets: sheetTasks.copy_sheets ? { source_sheets: sheetTasks.source_sheets.split(',').map(sheet => sheet.trim()) } : false,
    };
    formData.append('tasks', JSON.stringify(tasks));
  }
  if (operation === 'bulk-rename') {
    formData.append('rename_pattern', bulkTasks.rename_pattern);
  }
  if (operation === 'batch-convert') {
    formData.append('input_format', bulkTasks.batch_input_format);
    formData.append('output_format', bulkTasks.batch_output_format);
  }
  if (operation === 'batch-clean') {
    const tasks = {
      remove_empty_rows: cleanTasks.remove_empty_rows,
      remove_empty_columns: cleanTasks.remove_empty_columns,
      remove_duplicates: cleanTasks.remove_duplicates
        ? { columns: cleanTasks.duplicate_columns.split(',').map(col => col.trim()) }
        : false,
      replace_nulls: cleanTasks.replace_nulls ? { value: cleanTasks.null_value } : false,
      trim_whitespace: cleanTasks.trim_whitespace,
      standardize_columns: cleanTasks.standardize_columns ? { format: cleanTasks.column_format } : false,
      change_data_types: cleanTasks.change_data_types
        ? { [cleanTasks.data_types.column]: cleanTasks.data_types.type }
        : false,
      apply_formulas: cleanTasks.apply_formulas
        ? { [cleanTasks.formulas.new_column]: cleanTasks.formulas.formula }
        : false,
      normalize_dates: cleanTasks.normalize_dates
        ? { column: cleanTasks.date_column, format: cleanTasks.date_format }
        : false,
    };
    formData.append('tasks', JSON.stringify(tasks));
  }

  try {
    console.log(`Sending request to /${operation} with files:`, Array.from(files).map(f => f.name));
    const response = await axios.post(`http://localhost:8000/${operation}`, formData, {
      responseType: 'blob',
    });

    console.log('Response received, Content-Type:', response.headers['content-type']);
    const contentType = response.headers['content-type'];
    if (contentType.includes('application/json') && operation === 'extract' && extractTasks.extract_metadata) {
      const metadata = await response.data.text().then(JSON.parse);
      setExtractTasks({ ...extractTasks, metadata });
      setLoading(false);
      return;
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const extMap: { [key: string]: string } = { excel: 'xlsx', csv: 'csv', json: 'json', xml: 'xml' };
    const filename = operation === 'merge'
      ? `merged_${files[0].name.split('.').pop()}.${files[0].name.split('.').pop()}`
      : operation === 'split'
      ? `split_${files[0].name}.zip`
      : operation === 'convert'
      ? `converted_${files[0].name.split('.')[0]}.${extMap[outputFormat]}`
      : operation === 'clean'
      ? `cleaned_${files[0].name}`
      : operation === 'extract'
      ? `extracted_${files[0].name}`
      : operation === 'combine-sheets'
      ? `combined_sheets_${files[0].name}`
      : operation === 'split-to-sheets'
      ? `split_sheets_${files[0].name}`
      : operation === 'rename-sheets'
      ? `renamed_sheets_${files[0].name}`
      : operation === 'reorder-sheets'
      ? `reordered_sheets_${files[0].name}`
      : operation === 'copy-sheets'
      ? `copied_sheets_${files[0].name}`
      : operation === 'bulk-rename'
      ? `renamed_files.zip`
      : operation === 'bulk-compress'
      ? `compressed_files.zip`
      : operation === 'batch-convert'
      ? `batch_converted_files.zip`
      : `batch_cleaned_files.zip`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    console.log(`Download triggered for ${filename}`);
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    alert(`Download should have started. Check your Downloads folder for ${filename}.`);
  } catch (err: any) {
    console.error('Axios error:', err);
    if (err.response && err.response.data) {
      try {
        const text = await new Response(err.response.data).text();
        const json = JSON.parse(text);
        if (Array.isArray(json.detail)) {
          const messages = json.detail.map((e: any) => e.msg).join('; ');
          setError(messages || `Error processing files. Please try again.`);
        } else {
          setError(json.detail || `Error processing files. Please try again.`);
        }
      } catch {
        setError(`Error processing files: Invalid response from server.`);
      }
    } else if (err.request) {
      setError(`Network error: Unable to reach the server at http://localhost:8000. Please ensure the backend is running.`);
    } else {
      setError(`Error processing files: ${err.message}`);
    }
  } finally {
    setLoading(false);
  }
};

  const toggleDropdown = (feature: string) => {
    setOpenDropdown(openDropdown === feature ? null : feature);
  };

  const handleToolSelect = (
    tool: 'merge' | 'split' | 'convert' | 'clean' | 'extract' | 
    'combine-sheets' | 'split-to-sheets' | 'rename-sheets' | 'reorder-sheets' | 'copy-sheets' | 
    'bulk-rename' | 'bulk-compress' | 'batch-convert' | 'batch-clean',
    newInputFormat?: string,
    newOutputFormat?: string
  ) => {
    setOperation(tool);
    setFiles(null);
    setError(null);
    setRowsPerFile(null);
    if (tool === 'convert') {
      setInputFormat(newInputFormat || 'excel');
      setOutputFormat(newOutputFormat || 'csv');
    } else if (tool === 'batch-convert') {
      setBulkTasks({ ...bulkTasks, batch_input_format: newInputFormat || 'excel', batch_output_format: newOutputFormat || 'csv' });
    } else {
      setInputFormat('excel');
      setOutputFormat('csv');
    }
    setCleanTasks({
      remove_empty_rows: false,
      remove_empty_columns: false,
      remove_duplicates: false,
      duplicate_columns: '',
      replace_nulls: false,
      null_value: '',
      trim_whitespace: false,
      standardize_columns: false,
      column_format: 'lowercase_underscore',
      change_data_types: false,
      data_types: { column: '', type: 'int' },
      apply_formulas: false,
      formulas: { new_column: '', formula: '' },
      normalize_dates: false,
      date_column: '',
      date_format: '%Y-%m-%d',
    });
    setExtractTasks({
      extract_rows_by_index: false,
      row_start: '',
      row_end: '',
      extract_rows_by_condition: false,
      row_condition: '',
      extract_columns: false,
      columns: '',
      apply_filter: false,
      filter_condition: '',
      extract_sheets: false,
      sheets: '',
      extract_metadata: false,
      metadata: null,
    });
    setSheetTasks({
      combine_sheets: false,
      target_sheet: 'Combined',
      split_to_sheets: false,
      rows_per_sheet: null,
      rename_sheets: false,
      sheet_names: '',
      reorder_sheets: false,
      sheet_order: '',
      copy_sheets: false,
      source_sheets: '',
    });
    setBulkTasks({
      rename_pattern: '',
      compress_files: false,
      batch_input_format: 'excel',
      batch_output_format: 'csv',
      batch_clean_tasks: false,
    });
  };

  const conversionOptions = [
    { label: 'XLS to CSV', input: 'excel', output: 'csv' },
    { label: 'XLS to JSON', input: 'excel', output: 'json' },
    { label: 'XLS to XML', input: 'excel', output: 'xml' },
    { label: 'CSV to XLS', input: 'csv', output: 'excel' },
    { label: 'CSV to JSON', input: 'csv', output: 'json' },
    { label: 'CSV to XML', input: 'csv', output: 'xml' },
    { label: 'JSON to XLS', input: 'json', output: 'excel' },
    { label: 'JSON to CSV', input: 'json', output: 'csv' },
    { label: 'JSON to XML', input: 'json', output: 'xml' },
    { label: 'XML to XLS', input: 'xml', output: 'excel' },
    { label: 'XML to CSV', input: 'xml', output: 'csv' },
    { label: 'XML to JSON', input: 'xml', output: 'json' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg flex items-center justify-between px-6 py-4 fixed top-0 left-0 right-0 z-10">
        <div className="text-2xl font-bold text-blue-400">[Logo]</div>
        <h1 className="text-2xl font-semibold text-gray-100 flex-1 text-center">File Processor</h1>
        <div className="w-[72px]"></div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <aside className="bg-gray-800 w-64 fixed top-16 bottom-0 shadow-lg overflow-y-auto">
          <nav className="mt-6">
            {/* Merge & Split */}
            <div>
              <button
                onClick={() => toggleDropdown('merge-split')}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium">Merge & Split</span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${openDropdown === 'merge-split' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'merge-split' && (
                <div className="bg-gray-700">
                  <button
                    onClick={() => handleToolSelect('merge')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'merge' ? 'bg-gray-600' : ''}`}
                  >
                    Merge
                  </button>
                  <button
                    onClick={() => handleToolSelect('split')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'split' ? 'bg-gray-600' : ''}`}
                  >
                    Split
                  </button>
                </div>
              )}
            </div>

            {/* File Convert */}
            <div>
              <button
                onClick={() => toggleDropdown('convert')}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium">File Convert</span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${openDropdown === 'convert' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'convert' && (
                <div className="bg-gray-700">
                  {conversionOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleToolSelect('convert', option.input, option.output)}
                      className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${
                        operation === 'convert' && inputFormat === option.input && outputFormat === option.output ? 'bg-gray-600' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Data Cleaner */}
            <div>
              <button
                onClick={() => toggleDropdown('clean')}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium">Data Cleaner</span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${openDropdown === 'clean' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'clean' && (
                <div className="bg-gray-700">
                  <button
                    onClick={() => handleToolSelect('clean')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'clean' ? 'bg-gray-600' : ''}`}
                  >
                    Clean & Transform
                  </button>
                </div>
              )}
            </div>

            {/* Data Extraction & Filtering */}
            <div>
              <button
                onClick={() => toggleDropdown('extract')}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium">Data Extraction & Filtering</span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${openDropdown === 'extract' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'extract' && (
                <div className="bg-gray-700">
                  <button
                    onClick={() => handleToolSelect('extract')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'extract' ? 'bg-gray-600' : ''}`}
                  >
                    Extract & Filter
                  </button>
                </div>
              )}
            </div>

            {/* Sheet and File Management */}
           <div>
  <button
    onClick={() => toggleDropdown('sheet-management')}
    className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
  >
    <span className="font-medium">Sheet and File Management</span>
    <svg
      className={`w-5 h-5 transform transition-transform ${openDropdown === 'sheet-management' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
              {openDropdown === 'sheet-management' && (
  <div className="ml-4 mt-2 space-y-2">
    <button
      onClick={() => setOperation('combine-sheets')}
      className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700"
    >
      Combine Sheets
    </button>
    <button
      onClick={() => setOperation('split-to-sheets')}
      className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700"
    >
      Split to Sheets
    </button>
    <button
      onClick={() => setOperation('rename-sheets')}
      className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700"
    >
      Rename Sheets
    </button>
    <button
      onClick={() => setOperation('reorder-sheets')}
      className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700"
    >
      Reorder Sheets
    </button>
    <button
      onClick={() => setOperation('copy-sheets')}
      className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700"
    >
      Copy Sheets
    </button>
  </div>
)}
            </div>

            {/* Bulk File Utilities */}
            <div>
              <button
                onClick={() => toggleDropdown('bulk-utilities')}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium">Bulk File Utilities</span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${openDropdown === 'bulk-utilities' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'bulk-utilities' && (
                <div className="bg-gray-700">
                  <button
                    onClick={() => handleToolSelect('bulk-rename')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'bulk-rename' ? 'bg-gray-600' : ''}`}
                  >
                    Bulk Rename
                  </button>
                  <button
                    onClick={() => handleToolSelect('bulk-compress')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'bulk-compress' ? 'bg-gray-600' : ''}`}
                  >
                    Bulk Compress
                  </button>
                  <button
                    onClick={() => handleToolSelect('batch-convert')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'batch-convert' ? 'bg-gray-600' : ''}`}
                  >
                    Batch Convert
                  </button>
                  <button
                    onClick={() => handleToolSelect('batch-clean')}
                    className={`w-full px-6 py-2 text-left text-gray-300 hover:bg-gray-600 ${operation === 'batch-clean' ? 'bg-gray-600' : ''}`}
                  >
                    Batch Clean
                  </button>
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8 flex justify-center items-center overflow-y-auto min-h-[calc(100vh-4rem)]">
          <div className="bg-gray-800 rounded-xl shadow-lg p-8 max-w-lg w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">
              {operation === 'merge' ? 'Merge Files' :
               operation === 'split' ? 'Split File' :
               operation === 'convert' ? 'Convert File' :
               operation === 'clean' ? 'Clean & Transform' :
               operation === 'extract' ? 'Extract & Filter' :
               operation === 'combine-sheets' ? 'Combine Sheets' :
               operation === 'split-to-sheets' ? 'Split to Sheets' :
               operation === 'rename-sheets' ? 'Rename Sheets' :
               operation === 'reorder-sheets' ? 'Reorder Sheets' :
               operation === 'copy-sheets' ? 'Copy Sheets' :
               operation === 'bulk-rename' ? 'Bulk Rename Files' :
               operation === 'bulk-compress' ? 'Bulk Compress Files' :
               operation === 'batch-convert' ? 'Batch Convert Files' :
               'Batch Clean Files'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">
  {['combine-sheets', 'split-to-sheets', 'rename-sheets', 'reorder-sheets', 'copy-sheets'].includes(operation)
    ? 'Upload Excel File (Excel only)'
    : 'Upload File(s) (Excel, CSV, JSON, XML)'}
</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging ? 'border-blue-400 bg-gray-700' : 'border-gray-600 hover:border-blue-500'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                 <input
  type="file"
  multiple={['merge', 'copy-sheets', 'bulk-rename', 'bulk-compress', 'batch-convert', 'batch-clean'].includes(operation)}
  accept={
    ['combine-sheets', 'split-to-sheets', 'rename-sheets', 'reorder-sheets', 'copy-sheets'].includes(operation)
      ? '.xlsx,.xls'
      : '.xlsx,.xls,.csv,.json,.xml'
  }
  onChange={handleFileChange}
  className="w-full text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
/>
                  <label
                    htmlFor="files"
                    className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {files && files.length > 0
                      ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
                      : ['merge', 'bulk-rename', 'bulk-compress', 'batch-convert', 'batch-clean', 'copy-sheets'].includes(operation)
                        ? 'Drag and drop files here or click to upload'
                        : 'Drag and drop a file here or click to upload'}
                  </label>
                  {files && files.length > 0 && (
                    <ul className="mt-2 text-sm text-gray-400 max-h-24 overflow-y-auto">
                      {Array.from(files).map((file, index) => (
                        <li key={index} className="truncate">{file.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {operation === 'split' && (
                <div>
                  <label htmlFor="rowsPerFile" className="block text-sm font-medium text-gray-300 mb-2">
                    Rows per File
                  </label>
                  <input
                    type="number"
                    id="rowsPerFile"
                    min="1"
                    value={rowsPerFile || ''}
                    onChange={(e) => setRowsPerFile(parseInt(e.target.value) || null)}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                    placeholder="Enter number of rows per file"
                  />
                </div>
              )}
              {operation === 'convert' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="inputFormat" className="block text-sm font-medium text-gray-300 mb-2">
                      Input Format
                    </label>
                    <select
                      id="inputFormat"
                      value={inputFormat}
                      onChange={(e) => setInputFormat(e.target.value)}
                      className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="excel">Excel (.xlsx, .xls)</option>
                      <option value="csv">CSV (.csv)</option>
                      <option value="json">JSON (.json)</option>
                      <option value="xml">XML (.xml)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="outputFormat" className="block text-sm font-medium text-gray-300 mb-2">
                      Output Format
                    </label>
                    <select
                      id="outputFormat"
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="excel">Excel (.xlsx)</option>
                      <option value="csv">CSV (.csv)</option>
                      <option value="json">JSON (.json)</option>
                      <option value="xml">XML (.xml)</option>
                    </select>
                  </div>
                </div>
              )}
              {operation === 'clean' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Enter column names as they appear in the file. If "Standardize Column Names" is enabled, use the standardized names (e.g., 'age' instead of 'Age' for lowercase).
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.remove_empty_rows}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, remove_empty_rows: e.target.checked })}
                        className="mr-2"
                      />
                      Remove Empty Rows
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.remove_empty_columns}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, remove_empty_columns: e.target.checked })}
                        className="mr-2"
                      />
                      Remove Empty Columns
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.remove_duplicates}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, remove_duplicates: e.target.checked })}
                        className="mr-2"
                      />
                      Remove Duplicates
                    </label>
                    {cleanTasks.remove_duplicates && (
                      <input
                        type="text"
                        value={cleanTasks.duplicate_columns}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, duplicate_columns: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Enter columns (comma-separated, e.g., name,city)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.replace_nulls}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, replace_nulls: e.target.checked })}
                        className="mr-2"
                      />
                      Replace Null Values
                    </label>
                    {cleanTasks.replace_nulls && (
                      <input
                        type="text"
                        value={cleanTasks.null_value}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, null_value: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Enter replacement value (e.g., Unknown)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.trim_whitespace}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, trim_whitespace: e.target.checked })}
                        className="mr-2"
                      />
                      Trim Whitespace
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.standardize_columns}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, standardize_columns: e.target.checked })}
                        className="mr-2"
                      />
                      Standardize Column Names
                    </label>
                    {cleanTasks.standardize_columns && (
                      <select
                        value={cleanTasks.column_format}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, column_format: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                      >
                        <option value="lowercase_underscore">Lowercase with Underscores (e.g., first_name)</option>
                        <option value="lowercase">Lowercase (e.g., firstname)</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.change_data_types}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, change_data_types: e.target.checked })}
                        className="mr-2"
                      />
                      Change Data Types
                    </label>
                    {cleanTasks.change_data_types && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={cleanTasks.data_types.column}
                          onChange={(e) => setCleanTasks({ ...cleanTasks, data_types: { ...cleanTasks.data_types, column: e.target.value } })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="Enter column name (e.g., age)"
                        />
                        <select
                          value={cleanTasks.data_types.type}
                          onChange={(e) => setCleanTasks({ ...cleanTasks, data_types: { ...cleanTasks.data_types, type: e.target.value } })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        >
                          <option value="int">Integer</option>
                          <option value="float">Float</option>
                          <option value="str">String</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.apply_formulas}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, apply_formulas: e.target.checked })}
                        className="mr-2"
                      />
                      Apply Formulas
                    </label>
                    {cleanTasks.apply_formulas && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={cleanTasks.formulas.new_column}
                          onChange={(e) => setCleanTasks({ ...cleanTasks, formulas: { ...cleanTasks.formulas, new_column: e.target.value } })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="New column name (e.g., double_age)"
                        />
                        <input
                          type="text"
                          value={cleanTasks.formulas.formula}
                          onChange={(e) => setCleanTasks({ ...cleanTasks, formulas: { ...cleanTasks.formulas, formula: e.target.value } })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="Formula (e.g., age * 2, uppercase(name))"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.normalize_dates}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, normalize_dates: e.target.checked })}
                        className="mr-2"
                      />
                      Normalize Dates
                    </label>
                    {cleanTasks.normalize_dates && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={cleanTasks.date_column}
                          onChange={(e) => setCleanTasks({ ...cleanTasks, date_column: e.target.value })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="Date column (e.g., date)"
                        />
                        <input
                          type="text"
                          value={cleanTasks.date_format}
                          onChange={(e) => setCleanTasks({ ...cleanTasks, date_format: e.target.value })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="Output format (e.g., %Y-%m-%d)"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {operation === 'extract' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Enter column names exactly as they appear in the file. Use zero-based indexing for rows and sheets.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={extractTasks.extract_rows_by_index}
                        onChange={(e) => setExtractTasks({ ...extractTasks, extract_rows_by_index: e.target.checked })}
                        className="mr-2"
                      />
                      Extract Rows by Index
                    </label>
                    {extractTasks.extract_rows_by_index && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="number"
                          value={extractTasks.row_start}
                          onChange={(e) => setExtractTasks({ ...extractTasks, row_start: e.target.value })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="Start row (e.g., 0)"
                        />
                        <input
                          type="number"
                          value={extractTasks.row_end}
                          onChange={(e) => setExtractTasks({ ...extractTasks, row_end: e.target.value })}
                          className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                          placeholder="End row (e.g., 4)"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={extractTasks.extract_rows_by_condition}
                        onChange={(e) => setExtractTasks({ ...extractTasks, extract_rows_by_condition: e.target.checked })}
                        className="mr-2"
                      />
                      Extract Rows by Condition
                    </label>
                    {extractTasks.extract_rows_by_condition && (
                      <input
                        type="text"
                        value={extractTasks.row_condition}
                        onChange={(e) => setExtractTasks({ ...extractTasks, row_condition: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Condition (e.g., age > 30)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={extractTasks.extract_columns}
                        onChange={(e) => setExtractTasks({ ...extractTasks, extract_columns: e.target.checked })}
                        className="mr-2"
                      />
                      Extract Specific Columns
                    </label>
                    {extractTasks.extract_columns && (
                      <input
                        type="text"
                        value={extractTasks.columns}
                        onChange={(e) => setExtractTasks({ ...extractTasks, columns: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Columns (e.g., name, age)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={extractTasks.apply_filter}
                        onChange={(e) => setExtractTasks({ ...extractTasks, apply_filter: e.target.checked })}
                        className="mr-2"
                      />
                      Apply Filter
                    </label>
                    {extractTasks.apply_filter && (
                      <input
                        type="text"
                        value={extractTasks.filter_condition}
                        onChange={(e) => setExtractTasks({ ...extractTasks, filter_condition: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Filter (e.g., price > 100)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={extractTasks.extract_sheets}
                        onChange={(e) => setExtractTasks({ ...extractTasks, extract_sheets: e.target.checked })}
                        className="mr-2"
                      />
                      Extract Specific Sheets (Excel Only)
                    </label>
                    {extractTasks.extract_sheets && (
                      <input
                        type="text"
                        value={extractTasks.sheets}
                        onChange={(e) => setExtractTasks({ ...extractTasks, sheets: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Sheet names or indices (e.g., Sheet1, 1)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={extractTasks.extract_metadata}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setExtractTasks({ ...extractTasks, extract_metadata: newValue });
                          if (newValue && files) {
                            handleMetadataExtraction(files);
                          }
                        }}
                        className="mr-2"
                      />
                      Extract Metadata
                    </label>
                    {extractTasks.extract_metadata && extractTasks.metadata && (
                      <div className="mt-2 p-4 bg-gray-700 rounded-lg text-gray-300">
                        <p><strong>Sheet Names:</strong> {extractTasks.metadata.sheet_names.join(', ')}</p>
                        <p><strong>Row Count:</strong> {extractTasks.metadata.row_count}</p>
                        <p><strong>Column Count:</strong> {extractTasks.metadata.column_count}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {operation === 'combine-sheets' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Upload an Excel file to combine all sheets into one.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={sheetTasks.combine_sheets}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, combine_sheets: e.target.checked })}
                        className="mr-2"
                      />
                      Combine All Sheets
                    </label>
                    {sheetTasks.combine_sheets && (
                      <input
                        type="text"
                        value={sheetTasks.target_sheet}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, target_sheet: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Target sheet name (e.g., Combined)"
                      />
                    )}
                  </div>
                </div>
              )}
              {operation === 'split-to-sheets' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Split data from one Excel file into multiple sheets.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={sheetTasks.split_to_sheets}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, split_to_sheets: e.target.checked })}
                        className="mr-2"
                      />
                      Split to Multiple Sheets
                    </label>
                    {sheetTasks.split_to_sheets && (
                      <input
                        type="number"
                        value={sheetTasks.rows_per_sheet || ''}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, rows_per_sheet: parseInt(e.target.value) || null })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Rows per sheet (e.g., 100)"
                      />
                    )}
                  </div>
                </div>
              )}
              {operation === 'rename-sheets' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Enter new sheet names in order, comma-separated.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={sheetTasks.rename_sheets}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, rename_sheets: e.target.checked })}
                        className="mr-2"
                      />
                      Rename Sheets
                    </label>
                    {sheetTasks.rename_sheets && (
                      <input
                        type="text"
                        value={sheetTasks.sheet_names}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, sheet_names: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="New names (e.g., Data1, Data2, Data3)"
                      />
                    )}
                  </div>
                </div>
              )}
              {operation === 'reorder-sheets' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Enter sheet names or indices in desired order, comma-separated.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={sheetTasks.reorder_sheets}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, reorder_sheets: e.target.checked })}
                        className="mr-2"
                      />
                      Reorder Sheets
                    </label>
                    {sheetTasks.reorder_sheets && (
                      <input
                        type="text"
                        value={sheetTasks.sheet_order}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, sheet_order: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Order (e.g., Sheet1, 1, Sheet3)"
                      />
                    )}
                  </div>
                </div>
              )}
              {operation === 'copy-sheets' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Upload source and target Excel files. Specify sheets to copy from source.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={sheetTasks.copy_sheets}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, copy_sheets: e.target.checked })}
                        className="mr-2"
                      />
                      Copy Sheets
                    </label>
                    {sheetTasks.copy_sheets && (
                      <input
                        type="text"
                        value={sheetTasks.source_sheets}
                        onChange={(e) => setSheetTasks({ ...sheetTasks, source_sheets: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Source sheets (e.g., Sheet1, 1)"
                      />
                    )}
                  </div>
                </div>
              )}
              {operation === 'bulk-rename' && (
                <div className="space-y-4">
                 <p className="text-sm text-gray-400">
  Note: Use {`{index}`} for sequential numbers, {`{filename}`} for original name (e.g., "data_{`{index}`}_{`{filename}`}").
</p>
                  <div>
                    <input
                      type="text"
                      value={bulkTasks.rename_pattern}
                      onChange={(e) => setBulkTasks({ ...bulkTasks, rename_pattern: e.target.value })}
                      className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                      placeholder="Rename pattern (e.g., data_{index}_{filename})"
                    />
                  </div>
                </div>
              )}
              {operation === 'bulk-compress' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Upload multiple files to compress into a ZIP.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={bulkTasks.compress_files}
                        onChange={(e) => setBulkTasks({ ...bulkTasks, compress_files: e.target.checked })}
                        className="mr-2"
                      />
                      Compress Files
                    </label>
                  </div>
                </div>
              )}
              {operation === 'batch-convert' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Convert multiple files to the selected output format.
                  </p>
                  <div>
                    <label htmlFor="batchInputFormat" className="block text-sm font-medium text-gray-300 mb-2">
                      Input Format
                    </label>
                    <select
                      id="batchInputFormat"
                      value={bulkTasks.batch_input_format}
                      onChange={(e) => setBulkTasks({ ...bulkTasks, batch_input_format: e.target.value })}
                      className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="excel">Excel (.xlsx, .xls)</option>
                      <option value="csv">CSV (.csv)</option>
                      <option value="json">JSON (.json)</option>
                      <option value="xml">XML (.xml)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="batchOutputFormat" className="block text-sm font-medium text-gray-300 mb-2">
                      Output Format
                    </label>
                    <select
                      id="batchOutputFormat"
                      value={bulkTasks.batch_output_format}
                      onChange={(e) => setBulkTasks({ ...bulkTasks, batch_output_format: e.target.value })}
                      className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="excel">Excel (.xlsx)</option>
                      <option value="csv">CSV (.csv)</option>
                      <option value="json">JSON (.json)</option>
                      <option value="xml">XML (.xml)</option>
                    </select>
                  </div>
                </div>
              )}
              {operation === 'batch-clean' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Note: Apply cleaning tasks to all uploaded files.
                  </p>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={bulkTasks.batch_clean_tasks}
                        onChange={(e) => setBulkTasks({ ...bulkTasks, batch_clean_tasks: e.target.checked })}
                        className="mr-2"
                      />
                      Enable Batch Cleaning
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.remove_empty_rows}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, remove_empty_rows: e.target.checked })}
                        className="mr-2"
                      />
                      Remove Empty Rows
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.remove_empty_columns}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, remove_empty_columns: e.target.checked })}
                        className="mr-2"
                      />
                      Remove Empty Columns
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.remove_duplicates}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, remove_duplicates: e.target.checked })}
                        className="mr-2"
                      />
                      Remove Duplicates
                    </label>
                    {cleanTasks.remove_duplicates && (
                      <input
                        type="text"
                        value={cleanTasks.duplicate_columns}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, duplicate_columns: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Enter columns (comma-separated, e.g., name,city)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.replace_nulls}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, replace_nulls: e.target.checked })}
                        className="mr-2"
                      />
                      Replace Null Values
                    </label>
                    {cleanTasks.replace_nulls && (
                      <input
                        type="text"
                        value={cleanTasks.null_value}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, null_value: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                        placeholder="Enter replacement value (e.g., Unknown)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.trim_whitespace}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, trim_whitespace: e.target.checked })}
                        className="mr-2"
                      />
                      Trim Whitespace
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={cleanTasks.standardize_columns}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, standardize_columns: e.target.checked })}
                        className="mr-2"
                      />
                      Standardize Column Names
                    </label>
                    {cleanTasks.standardize_columns && (
                      <select
                        value={cleanTasks.column_format}
                        onChange={(e) => setCleanTasks({ ...cleanTasks, column_format: e.target.value })}
                        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                      >
                        <option value="lowercase_underscore">Lowercase with Underscores (e.g., first_name)</option>
                        <option value="lowercase">Lowercase (e.g., firstname)</option>
                      </select>
                    )}
                  </div>
                </div>
              )}
                
                <div className="space-y-4">
  <h3 className="text-lg font-semibold text-gray-100">File Validation & Security</h3>
  <div>
    <label className="flex items-center text-sm font-medium text-gray-300">
      <input
        type="checkbox"
        checked={validationSettings.validateSchema}
        onChange={(e) => setValidationSettings({ ...validationSettings, validateSchema: e.target.checked })}
        className="mr-2"
      />
      Validate Schema Consistency
    </label>
    <p className="text-sm text-gray-400 ml-6">Ensure consistent columns across sheets or files.</p>
  </div>
  <div>
    <label className="flex items-center text-sm font-medium text-gray-300">
      <input
        type="checkbox"
        checked={validationSettings.validateFormat}
        onChange={(e) => setValidationSettings({ ...validationSettings, validateFormat: e.target.checked })}
        className="mr-2"
      />
      Validate JSON/CSV Format
    </label>
    <p className="text-sm text-gray-400 ml-6">Check JSON and CSV files for valid syntax.</p>
  </div>
  <div>
    <label className="flex items-center text-sm font-medium text-gray-300">
      <input
        type="checkbox"
        checked={validationSettings.checkCorruptEmpty}
        onChange={(e) => setValidationSettings({ ...validationSettings, checkCorruptEmpty: e.target.checked })}
        className="mr-2"
      />
      Check for Corrupt or Empty Files
    </label>
    <p className="text-sm text-gray-400 ml-6">Detect empty or unreadable files.</p>
  </div>
  <div>
    <label className="flex items-center text-sm font-medium text-gray-300">
      <input
        type="checkbox"
        checked={validationSettings.passwordProtect}
        onChange={(e) => setValidationSettings({ ...validationSettings, passwordProtect: e.target.checked, password: '' })}
        className="mr-2"
      />
      Password-Protect Excel Output
    </label>
    {validationSettings.passwordProtect && (
      <input
        type="password"
        value={validationSettings.password}
        onChange={(e) => setValidationSettings({ ...validationSettings, password: e.target.value })}
        className="mt-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2 focus:outline-none focus:border-blue-500"
        placeholder="Enter password for Excel file"
      />
    )}
    <p className="text-sm text-gray-400 ml-6">Applies to Excel outputs only (e.g., convert to Excel, sheet operations).</p>
  </div>
</div>

              {error && (
                <div className="flex items-center bg-red-900 text-red-200 p-4 rounded-lg">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p>{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-500 transition-colors disabled:bg-blue-800 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {operation === 'merge' ? 'Merging...' :
                     operation === 'split' ? 'Splitting...' :
                     operation === 'convert' ? 'Converting...' :
                     operation === 'clean' ? 'Cleaning...' :
                     operation === 'extract' ? 'Extracting...' :
                     operation === 'combine-sheets' ? 'Combining Sheets...' :
                     operation === 'split-to-sheets' ? 'Splitting to Sheets...' :
                     operation === 'rename-sheets' ? 'Renaming Sheets...' :
                     operation === 'reorder-sheets' ? 'Reordering Sheets...' :
                     operation === 'copy-sheets' ? 'Copying Sheets...' :
                     operation === 'bulk-rename' ? 'Renaming Files...' :
                     operation === 'bulk-compress' ? 'Compressing Files...' :
                     operation === 'batch-convert' ? 'Batch Converting...' :
                     'Batch Cleaning...'}
                  </>
                ) : (
                  operation === 'merge' ? 'Merge Files' :
                  operation === 'split' ? 'Split File' :
                  operation === 'convert' ? 'Convert File' :
                  operation === 'clean' ? 'Clean File' :
                  operation === 'extract' ? 'Extract Data' :
                  operation === 'combine-sheets' ? 'Combine Sheets' :
                  operation === 'split-to-sheets' ? 'Split to Sheets' :
                  operation === 'rename-sheets' ? 'Rename Sheets' :
                  operation === 'reorder-sheets' ? 'Reorder Sheets' :
                  operation === 'copy-sheets' ? 'Copy Sheets' :
                  operation === 'bulk-rename' ? 'Bulk Rename Files' :
                  operation === 'bulk-compress' ? 'Bulk Compress Files' :
                  operation === 'batch-convert' ? 'Batch Convert Files' :
                  'Batch Clean Files'
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}