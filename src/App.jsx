import { useState, useCallback, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import './App.css'

// Spread mode table structure
const spreadPages = {
  1: [
    ['Current Assets*', null],
    ['Cash', ''],
    ['Accounts Receivable', ''],
    ['Inventory', ''],
    ['Other Current Assets', ''],
    ['Total Current Assets', '']
  ],
  2: [
    ['Long-Term Assets*', null],
    ['Fixed Assets', ''],
    ['Intangibles', ''],
    ['Other Long-Term Assets', ''],
    ['Total Long-Term Assets', '']
  ],
  3: [
    ['Current Liabilities*', null],
    ['Short-term debt', ''],
    ['Current Portion LTD', ''],
    ['Accounts Payable', ''],
    ['Taxes Payable', ''],
    ['Other Current Liabilities', ''],
    ['Total Current Liabilities', '']
  ],
  4: [
    ['Long-term Liabilities*', null],
    ['Long-term debt', ''],
    ['Deferred taxes', ''],
    ['Other Long-term Liabilities', ''],
    ['Total Long-term Liabilities', ''],
    ['Total Liabilities', '']
  ],
  5: [
    ['Equity*', null],
    ['Total equity', ''],
    ['Total liabilities + equity', ''],
    [null, null]
  ],
  6: [
    ['Income Statement*', null],
    ['Sales', ''],
    ['COGS', ''],
    ['Depreciation COGS', ''],
    ['Gross Profit', '']
  ],
  7: [
    ['SG&A', ''],
    ['Depreciation', ''],
    ['Other OpEx', ''],
    ['Total OpEx', ''],
    ['Total Operating Profit', '']
  ],
  8: [
    ['Interest Expense', ''],
    ['Other Non OpEx', ''],
    ['Net Profit before Taxes', ''],
    ['Income Tax', ''],
    ['Net Profit', '']
  ],
  9: [
    ['Dividends', ''],
    [null, null],
    ['Cash Flow Statement*', null],
    ['Cash from P&L', ''],
    ['CFO', ''],
    ['CFI', ''],
    ['CapEx', ''],
    ['CFF', ''],
    [null, null]
  ]
}

function App() {
  const [selectedImage, setSelectedImage] = useState(null)
  const [detectedText, setDetectedText] = useState([])
  const [selectedWords, setSelectedWords] = useState([])
  const [extractedItems, setExtractedItems] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [isStarted, setIsStarted] = useState(false)
  const [mode, setMode] = useState(null)
  const [yearCount, setYearCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [spreadComplete, setSpreadComplete] = useState(false)
  
  const [spreadData, setSpreadData] = useState({})
  const [selectedCell, setSelectedCell] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [translationStage, setTranslationStage] = useState(1)
  const [translationRows, setTranslationRows] = useState([])
  const [selectedTranslationCell, setSelectedTranslationCell] = useState(null)
  const [completedTranslations, setCompletedTranslations] = useState([])
  const [numberHistory, setNumberHistory] = useState([])

  useEffect(() => {
    const newSpreadData = {}
    for (let page = 1; page <= 9; page++) {
      newSpreadData[page] = spreadPages[page].map(row => {
        if (row[0] === null) return row
        return [row[0], ...Array(yearCount - 1).fill('')]
      })
    }
    setSpreadData(newSpreadData)
  }, [yearCount])

  useEffect(() => {
    // Only process image when stage changes to 2
    if (translationStage === 2 && selectedImage) {
      console.log('Stage changed to 2, reprocessing image...');
      processImage(selectedImage);
    }
  }, [translationStage]);

  const handleStart = () => {
    setIsStarted(true)
  }

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode)
  }

  const handleYearSelect = (count) => {
    setYearCount(count + 1)
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, 9))
  }

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }

  const generateCSV = () => {
    let csvContent = 'Item'
    // Add year headers
    for (let i = 0; i < yearCount - 1; i++) {
      csvContent += `,Year ${i + 1}`
    }
    csvContent += '\n'

    // Add data from each page
    for (let page = 1; page <= 9; page++) {
      spreadData[page].forEach(row => {
        if (row[0] === null) {
          // Add empty row for null rows
          csvContent += '\n'
        } else {
          // Remove asterisk from headers when saving to CSV
          const label = row[0].endsWith('*') ? row[0].slice(0, -1) : row[0]
          csvContent += label
          
          // Add the data cells
          row.slice(1).forEach(cell => {
            csvContent += ','
            if (cell !== null) {
              csvContent += cell
            }
          })
          csvContent += '\n'
        }
      })
    }
    return csvContent
  }

  const downloadCSV = () => {
    const csvContent = generateCSV()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'financial_statement_spread.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSpreadComplete = () => {
    downloadCSV()
    setSpreadComplete(true)
    if (mode === 'both') {
      setDetectedText([])
      // Reprocess the image for translation mode
      processImage(selectedImage)
    }
  }

  const handleSwitchToTranslation = () => {
    setSpreadComplete(true)
    setDetectedText([])
    // Reprocess the image for translation mode
    processImage(selectedImage)
  }

  const handleSwitchToSpread = () => {
    setSpreadComplete(false)
    setDetectedText([])
    // Reprocess the image for spread mode
    processImage(selectedImage)
  }

  const handleCellClick = (rowIndex, colIndex) => {
    // Check if the row starts with null
    if (spreadData[currentPage][rowIndex][0] === null) return
    // Check if the cell itself is null
    if (spreadData[currentPage][rowIndex][colIndex] === null) return
    // Check if the row is marked as non-fillable (has *)
    if (spreadData[currentPage][rowIndex][0].endsWith('*')) return
    // Don't allow clicking the label column
    if (colIndex === 0) return
    
    setSelectedCell({ page: currentPage, row: rowIndex, col: colIndex })
    setEditingCell({ page: currentPage, row: rowIndex, col: colIndex })
  }

  const handleCellChange = (event, rowIndex, colIndex) => {
    const newSpreadData = { ...spreadData }
    newSpreadData[currentPage][rowIndex][colIndex] = event.target.value
    setSpreadData(newSpreadData)
  }

  const handleKeyDown = (event, rowIndex, colIndex) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      setEditingCell(null)
      setSelectedCell(null)
    }
  }

  const handleWordClick = (word) => {
    if (mode === 'spread' || (mode === 'both' && !spreadComplete)) {
      if (selectedCell) {
        const { page, row, col } = selectedCell
        const newSpreadData = { ...spreadData }
        const currentValue = newSpreadData[page][row][col] || ''
        newSpreadData[page][row][col] = currentValue ? `${currentValue} ${word}` : word
        setSpreadData(newSpreadData)
      }
    } else if (mode === 'translation' || (mode === 'both' && spreadComplete)) {
      if (translationStage === 1) {
        // Add new row with clicked text and empty cells for each year
        setTranslationRows(prevRows => [...prevRows, [word, ...Array(yearCount - 1).fill('')]])
      } else if (selectedTranslationCell !== null) {
        // Handle number clicks in stage 2
        const newRows = [...translationRows]
        const { row, col } = selectedTranslationCell
        const currentValue = newRows[row][col] || ''
        const newValue = currentValue ? `${currentValue} ${word}` : word
        newRows[row][col] = newValue
        setTranslationRows(newRows)
        
        // Record this addition in history
        setNumberHistory(prev => [...prev, {
          row,
          col,
          previousValue: currentValue,
          addedValue: word
        }])
      }
    }
  }

  const handleNextStage = () => {
    console.log('Moving to stage 2...');
    // Clean up the text in column 1 before moving to stage 2
    const cleanedRows = translationRows.map(row => {
      // Remove all non-letter characters except spaces, hyphens, and parentheses
      const cleanedText = row[0].replace(/[^a-zA-Z\s\-()]/g, '');
      return [cleanedText.trim(), row[1]];
    });
    setTranslationRows(cleanedRows);
    setTranslationStage(2);
  };

  const handleTranslationCellClick = (rowIndex, colIndex) => {
    if (translationStage === 2) {
      setSelectedTranslationCell({ row: rowIndex, col: colIndex })
      setEditingCell({ row: rowIndex, col: colIndex })
    }
  }

  const handleTranslationCellChange = (event, rowIndex, colIndex) => {
    const newRows = [...translationRows]
    newRows[rowIndex][colIndex] = event.target.value
    setTranslationRows(newRows)
  }

  const handleTranslationRowClick = (rowIndex) => {
    if (translationStage === 1) {
      // In stage 1, clicking a row removes it
      setTranslationRows(prevRows => prevRows.filter((_, index) => index !== rowIndex));
    } else if (translationStage === 2) {
      // In stage 2, keep the existing cell selection behavior
      handleTranslationCellClick(rowIndex, 1);
    }
  };

  const processImage = async (imageData) => {
    console.log('Starting image processing...')
    console.log('Current mode:', mode)
    console.log('Translation stage:', translationStage)
    console.log('Spread complete:', spreadComplete)
    setIsProcessing(true)
    setDetectedText([]) // Clear previous results
    
    try {
      console.log('Creating Tesseract worker...')
      const worker = await createWorker()
      
      // Determine the current mode and stage
      const isTranslationMode = mode === 'translation' || (mode === 'both' && spreadComplete);
      const isSpreadMode = mode === 'spread' || (mode === 'both' && !spreadComplete);
      
      // Set OCR parameters based on the current mode and stage
      if (isSpreadMode || (isTranslationMode && translationStage === 2)) {
        // Number detection mode
        console.log('Setting number detection parameters');
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_char_whitelist: '$-0123456789,.',
          tessedit_pageseg_mode: '6'
        });
      } else if (isTranslationMode && translationStage === 1) {
        // Text detection mode
        console.log('Setting text detection parameters');
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_char_blacklist: '$0123456789',  // Exclude numbers in stage 1
          tessedit_pageseg_mode: '6'
        });
      }
      
      const result = await worker.recognize(imageData)
      console.log('Raw OCR Result:', result.data.text)
      
      // First, split into lines
      const lines = result.data.text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      console.log('All lines:', lines);
      
      // For translation mode Stage 1: return lines with letters
      if (isTranslationMode && translationStage === 1) {
        const textLines = lines.filter(line => {
          // Skip very short or empty lines
          if (line.length < 2) return false;
          
          // Must have at least one letter
          const hasLetter = /[a-zA-Z]/.test(line);
          if (!hasLetter) return false;
          
          // Split by large spaces (2 or more spaces)
          const parts = line.split(/\s{2,}/);
          // Take only the first part (before any large space)
          const textPart = parts[0].trim();
          
          // Skip if the remaining text is too short
          if (textPart.length < 2) return false;
          
          // Count meaningful characters in the text part
          const letters = (textPart.match(/[a-zA-Z]/g) || []).length;
          const numbers = (textPart.match(/\d/g) || []).length;
          const totalChars = textPart.length;
          
          // If it's mostly numbers (>70% of content), exclude it
          if (numbers > 0 && numbers / totalChars > 0.7) return false;
          
          // Allow common financial statement characters
          // This includes letters, numbers, spaces, basic punctuation, and common symbols
          const validCharsRegex = /^[a-zA-Z0-9\s\-\.,()&%$:;]+$/;
          if (!validCharsRegex.test(textPart)) return false;
          
          // Special cases to include
          const commonAbbreviations = /Inc\.|Corp\.|Ltd\.|LLC|LLP|S\.A\.|N\.V\.|plc|\bCo\b/i;
          const commonTerms = /R&D|SG&A|EBIT|EBITDA|P&L|Q[1-4]|FY\d{2,4}|[A-Z]{2,4}/;
          if (commonAbbreviations.test(textPart) || commonTerms.test(textPart)) return true;
          
          return true;
        }).map(line => {
          // For lines that pass the filter, only return the part before any large space
          const parts = line.split(/\s{2,}/);
          return parts[0].trim();
        });
        
        console.log('Text lines:', textLines);
        setDetectedText(textLines);
      }
      // For spread mode or translation mode Stage 2: extract numbers
      else if (isSpreadMode || (isTranslationMode && translationStage === 2)) {
        // ⚠️ CRITICAL: DO NOT MODIFY NUMBER PROCESSING LOGIC BELOW ⚠️
        // This logic is specifically tuned to work with the Tesseract settings above
        const processedText = lines.join(' ');
        console.log('Processed text:', processedText);
        
        // First, remove all $ symbols
        const textWithoutCurrency = processedText.replace(/\$/g, '');
        
        // Extract numbers with a more precise pattern
        // This pattern looks for:
        // 1. Optional minus sign
        // 2. One or more digits
        // 3. Optional comma followed by exactly 3 digits (for thousands)
        // 4. Optional decimal point followed by digits
        const numberPattern = /-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/g;
        const matches = textWithoutCurrency.match(numberPattern) || [];
        
        // Clean and format numbers
        const numbers = matches
          .map(num => {
            // Remove commas and convert to standard decimal format
            return num.replace(/,/g, '');
          })
          .filter((num, index, self) => {
            // Remove duplicates and ensure it's a valid number
            return self.indexOf(num) === index && !isNaN(parseFloat(num));
          });
        // ⚠️ CRITICAL: DO NOT MODIFY NUMBER PROCESSING LOGIC ABOVE ⚠️
        
        console.log('Extracted numbers:', numbers);
        setDetectedText(numbers);
      }
      
      await worker.terminate()
      console.log('Processing complete!')
    } catch (error) {
      console.error('OCR Error:', error)
      console.error('Error details:', error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNextImage = () => {
    // Save current rows if any exist
    if (translationRows.length > 0) {
      setCompletedTranslations(prev => [...prev, ...translationRows])
      setTranslationRows([])
    }
    
    // Reset the stage and clear the image
    setTranslationStage(1)
    setSelectedTranslationCell(null)
    setEditingCell(null)
    setDetectedText([])
    setSelectedImage(null)
  }

  const handlePaste = useCallback(async (event) => {
    console.log('Paste event detected')
    console.log('Current mode:', mode)
    console.log('Translation stage:', translationStage)
    console.log('Spread complete:', spreadComplete)
    
    const items = event.clipboardData?.items
    if (!items) {
      console.log('No items in clipboard')
      return
    }

    console.log('Clipboard items:', items)
    for (const item of items) {
      console.log('Item type:', item.type)
      if (item.type.startsWith('image')) {
        const file = item.getAsFile()
        console.log('Image file:', file)
        
        const reader = new FileReader()
        reader.onload = async (e) => {
          console.log('Image loaded')
          const imageData = e.target.result
          setSelectedImage(imageData)
          processImage(imageData)
        }
        reader.onerror = (e) => {
          console.error('FileReader error:', e)
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }, [mode, translationStage, spreadComplete])

  const handleDrop = useCallback(async (event) => {
    event.preventDefault()
    console.log('Drop event detected')
    console.log('Current mode:', mode)
    console.log('Translation stage:', translationStage)
    console.log('Spread complete:', spreadComplete)
    
    const items = event.dataTransfer?.files
    if (!items?.length) {
      console.log('No files dropped')
      return
    }

    const file = items[0]
    console.log('Dropped file:', file)
    if (file.type.startsWith('image')) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        console.log('Dropped image loaded')
        const imageData = e.target.result
        setSelectedImage(imageData)
        processImage(imageData)
      }
      reader.onerror = (e) => {
        console.error('FileReader error:', e)
      }
      reader.readAsDataURL(file)
    }
  }, [mode, translationStage, spreadComplete])

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
  }, [])

  const handleExtract = () => {
    if (selectedWords.length > 0) {
      setExtractedItems([...extractedItems, ...selectedWords])
      setSelectedWords([])
    }
  }

  const generateTranslationCSV = () => {
    const allRows = [...completedTranslations, ...translationRows]
    let csvContent = 'Text'
    // Add year headers
    for (let i = 0; i < yearCount - 1; i++) {
      csvContent += `,Year ${i + 1}`
    }
    csvContent += '\n'
    
    allRows.forEach(row => {
      csvContent += `"${row[0]}"`
      for (let i = 1; i < yearCount; i++) {
        csvContent += `,"${row[i] || ''}"`
      }
      csvContent += '\n'
    })
    return csvContent
  }

  const downloadTranslationCSV = () => {
    const csvContent = generateTranslationCSV()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'translation_data.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUndo = () => {
    if (numberHistory.length === 0) return;

    // Get the last addition
    const lastAddition = numberHistory[numberHistory.length - 1];
    const { row, col, previousValue } = lastAddition;

    // Update the cell with its previous value
    const newRows = [...translationRows];
    newRows[row][col] = previousValue;
    setTranslationRows(newRows);

    // Remove this action from history
    setNumberHistory(prev => prev.slice(0, -1));
  }

  const handleStartOver = () => {
    // Reset all state to initial values
    setSelectedImage(null)
    setDetectedText([])
    setSelectedWords([])
    setExtractedItems([])
    setIsProcessing(false)
    setIsStarted(false)
    setMode(null)
    setYearCount(1)
    setCurrentPage(1)
    setSpreadComplete(false)
    setSpreadData({})
    setSelectedCell(null)
    setEditingCell(null)
    setTranslationStage(1)
    setTranslationRows([])
    setSelectedTranslationCell(null)
    setCompletedTranslations([])
    setNumberHistory([])
  }

  if (!isStarted) {
    return (
      <div className="app-container">
        <div className="container">
          <h1>Financial Statement Scanner</h1>
          <div className="setup-container">
            <button className="start-button" onClick={handleStart}>
              Start New Process
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!mode) {
    return (
      <div className="app-container">
        <div className="container">
          <h1>Financial Statement Scanner</h1>
          <div className="setup-container">
            <h2>Select Process Mode</h2>
            <div className="mode-buttons">
              <button onClick={() => handleModeSelect('spread')}>Spread</button>
              <button onClick={() => handleModeSelect('translation')}>Translation</button>
              <button onClick={() => handleModeSelect('both')}>Spread + Translation</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (yearCount === 1) {
  return (
      <div className="app-container">
        <div className="container">
          <h1>Financial Statement Scanner</h1>
          <div className="setup-container">
            <h2>Select Number of Years</h2>
            <div className="year-buttons">
              <button onClick={() => handleYearSelect(1)}>1 Year</button>
              <button onClick={() => handleYearSelect(2)}>2 Years</button>
              <button onClick={() => handleYearSelect(3)}>3 Years</button>
              <button onClick={() => handleYearSelect(4)}>4 Years</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="container">
        <div className="header">
          <h1>Financial Statement Scanner</h1>
          <div className="header-buttons">
            <button 
              className="start-over-button header-button"
              onClick={handleStartOver}
            >
              Start Over
            </button>
            {mode === 'both' && !spreadComplete && (
              <>
                <button 
                  className="complete-button header-button"
                  onClick={handleSpreadComplete}
                >
                  Complete Spread
                </button>
                <button 
                  className="switch-mode-button header-button"
                  onClick={handleSwitchToTranslation}
                >
                  Switch to Translation
                </button>
              </>
            )}
            {mode === 'spread' && (
              <button 
                className="complete-button header-button"
                onClick={handleSpreadComplete}
              >
                Complete Spread
              </button>
            )}
            {((mode === 'translation' && (completedTranslations.length > 0 || translationRows.length > 0)) || 
              (mode === 'both' && spreadComplete && (completedTranslations.length > 0 || translationRows.length > 0))) && (
              <button 
                className="extract-button header-button"
                onClick={downloadTranslationCSV}
              >
                Extract Translation
              </button>
            )}
            {mode === 'both' && spreadComplete && (
              <button 
                className="switch-mode-button header-button"
                onClick={handleSwitchToSpread}
              >
                Switch to Spread
              </button>
            )}
          </div>
        </div>
        
        <div className="main-content">
          <div className="image-section">
            <div 
              className="paste-zone"
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              tabIndex="0"
            >
              {isProcessing ? (
                <div className="processing-message">Processing image...</div>
              ) : selectedImage ? (
                <div className="image-container">
                  <img src={selectedImage} alt="Uploaded statement" />
                </div>
              ) : (
                <div className="paste-instructions">
                  <p>Paste screenshot here (Ctrl+V)</p>
                  <p className="paste-subtext">or drag and drop an image</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-sections">
            {(mode === 'spread' || mode === 'both') && !spreadComplete && (
              <div className="detected-text">
                <h2>Detected Numbers</h2>
                <div className="words-list">
                  {detectedText.map((word, index) => (
                    <div
                      key={`${word}-${index}`}
                      className={`word-item number`}
                      onClick={() => handleWordClick(word)}
                    >
                      {word}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {(mode === 'translation' || (mode === 'both' && spreadComplete)) && (
              <div className="detected-text">
                <div className="detected-text-header">
                  <h2>{translationStage === 1 ? 'Select Text Items' : 'Add Numbers'}</h2>
                  {translationStage === 1 && translationRows.length > 0 ? (
                    <button 
                      className="next-stage-button"
                      onClick={handleNextStage}
                    >
                      Next Step
                    </button>
                  ) : translationStage === 2 && selectedTranslationCell !== null ? (
                    <button 
                      className="undo-button"
                      onClick={handleUndo}
                    >
                      Undo
                    </button>
                  ) : null}
                </div>
                <div className="words-list">
                  {detectedText.map((word, index) => (
                    <div
                      key={`${word}-${index}`}
                      className={`word-item ${translationStage === 2 ? 'number' : ''}`}
                      onClick={() => handleWordClick(word)}
                    >
                      {word}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="extracted-items">
              {(mode === 'spread' || mode === 'both') && !spreadComplete ? (
                <>
                  <div className="spread-controls">
                    <button onClick={handlePrevPage} disabled={currentPage === 1}>←</button>
                    <span>Page {currentPage}</span>
                    <button onClick={handleNextPage} disabled={currentPage === 9}>→</button>
                  </div>
                  <div className="spread-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          {Array(yearCount - 1).fill(0).map((_, i) => (
                            <th key={i}>Year {i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {spreadData[currentPage]?.map((row, rowIndex) => (
                          <tr key={rowIndex} className={row[0] === null ? 'blank-row' : ''}>
                            <td className={`${row[0]?.endsWith('*') ? 'bold-cell' : ''}`}>
                              {row[0] === null ? '' : row[0]}
                            </td>
                            {row.slice(1).map((cell, colIndex) => (
                              <td
                                key={colIndex}
                                className={`
                                  ${selectedCell?.page === currentPage && selectedCell?.row === rowIndex && selectedCell?.col === colIndex + 1 ? 'selected' : ''}
                                  ${row[0] === null || cell === null ? 'blank' : ''}
                                  ${row[0]?.endsWith('*') ? 'bold-cell' : ''}
                                `}
                                onClick={() => handleCellClick(rowIndex, colIndex + 1)}
                              >
                                {editingCell?.page === currentPage && 
                                 editingCell?.row === rowIndex && 
                                 editingCell?.col === colIndex + 1 ? (
                                  <input
                                    type="text"
                                    value={cell || ''}
                                    onChange={(e) => handleCellChange(e, rowIndex, colIndex + 1)}
                                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex + 1)}
                                    autoFocus
                                    className="cell-input"
                                  />
                                ) : (
                                  cell === null ? '' : cell
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="translation-table">
                  <h2>Translation Table</h2>
                  {translationStage === 2 && (
                    <div className="translation-controls">
                      <button 
                        className="next-image-button"
                        onClick={handleNextImage}
                      >
                        Next Image
        </button>
                    </div>
                  )}
                  <div className="tables-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Text</th>
                          {Array(yearCount - 1).fill(0).map((_, i) => (
                            <th key={i}>Year {i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {translationRows.map((row, rowIndex) => (
                          <tr 
                            key={rowIndex}
                            onClick={() => translationStage === 1 && handleTranslationRowClick(rowIndex)}
                            className={`
                              ${translationStage === 1 ? 'clickable-row' : ''}
                              ${selectedTranslationCell?.row === rowIndex ? 'selected' : ''}
                            `}
                          >
                            <td>{row[0]}</td>
                            {Array(yearCount - 1).fill(0).map((_, colIndex) => (
                              <td
                                key={colIndex}
                                className={selectedTranslationCell?.row === rowIndex && selectedTranslationCell?.col === colIndex + 1 ? 'selected' : ''}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  translationStage === 2 && handleTranslationCellClick(rowIndex, colIndex + 1);
                                }}
                              >
                                {editingCell?.row === rowIndex && editingCell?.col === colIndex + 1 ? (
                                  <input
                                    type="text"
                                    value={row[colIndex + 1] || ''}
                                    onChange={(e) => handleTranslationCellChange(e, rowIndex, colIndex + 1)}
                                    onKeyDown={(e) => handleKeyDown(e, rowIndex)}
                                    autoFocus
                                    className="cell-input"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  row[colIndex + 1] || ''
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
