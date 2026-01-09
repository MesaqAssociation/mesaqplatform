"use client"

import { useRef, useEffect, KeyboardEvent } from 'react'

type Variable = {
  key: string  // e.g., "name"
  display: string  // e.g., "Member Name"
  color: string  // e.g., "blue"
}

type VariableTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variables: Variable[]
  className?: string
  rows?: number
}

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g

export function VariableTextarea({ 
  value, 
  onChange, 
  placeholder = "Type your message...",
  variables,
  className = "",
  rows = 4
}: VariableTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)

  // Get variable info by key
  const getVariableInfo = (key: string): Variable | undefined => {
    return variables.find(v => v.key === key)
  }

  // Convert plain text with {{var}} to HTML with badges
  const textToHtml = (text: string): string => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    
    html = html.replace(VARIABLE_REGEX, (match, varKey) => {
      const varInfo = getVariableInfo(varKey)
      if (varInfo) {
        const colorClasses = {
          blue: 'bg-blue-100 text-blue-800 border-blue-200',
          green: 'bg-green-100 text-green-800 border-green-200',
          purple: 'bg-purple-100 text-purple-800 border-purple-200'
        }
        const colors = colorClasses[varInfo.color as keyof typeof colorClasses] || colorClasses.blue
        return `<span contenteditable="false" data-variable="${varKey}" class="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded border text-xs font-medium cursor-default select-all ${colors}">${varInfo.display}</span>`
      }
      return match
    })
    
    return html || '<br>' // Ensure there's at least a br for empty content
  }

  // Convert HTML back to plain text with {{var}}
  const htmlToText = (html: string): string => {
    const temp = document.createElement('div')
    temp.innerHTML = html
    
    // Replace variable spans with {{key}}
    const spans = temp.querySelectorAll('[data-variable]')
    spans.forEach(span => {
      const varKey = span.getAttribute('data-variable')
      const textNode = document.createTextNode(`{{${varKey}}}`)
      span.replaceWith(textNode)
    })
    
    // Get text content, handling br tags
    let text = ''
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent
      } else if (node.nodeName === 'BR') {
        text += '\n'
      } else if (node.childNodes) {
        node.childNodes.forEach(processNode)
      }
    }
    processNode(temp)
    
    return text.replace(/\u00A0/g, ' ') // Replace &nbsp; with regular space
  }

  // Update editor content when value changes externally
  useEffect(() => {
    if (editorRef.current && value !== lastValueRef.current) {
      const selection = window.getSelection()
      const hadFocus = document.activeElement === editorRef.current
      
      editorRef.current.innerHTML = textToHtml(value)
      lastValueRef.current = value
      
      // Restore cursor to end if we had focus
      if (hadFocus && selection) {
        const range = document.createRange()
        range.selectNodeContents(editorRef.current)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }, [value])

  // Initialize editor
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = textToHtml(value)
    }
  }, [])

  const handleInput = () => {
    if (editorRef.current) {
      const newValue = htmlToText(editorRef.current.innerHTML)
      lastValueRef.current = newValue
      onChange(newValue)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Handle backspace on variable badges
    if (e.key === 'Backspace') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (range.collapsed && range.startOffset === 0) {
          const prevSibling = range.startContainer.previousSibling as Element
          if (prevSibling?.getAttribute?.('data-variable')) {
            e.preventDefault()
            prevSibling.remove()
            handleInput()
            return
          }
        }
      }
    }
    
    // Handle delete on variable badges
    if (e.key === 'Delete') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const nextSibling = range.endContainer.nextSibling as Element
        if (nextSibling?.getAttribute?.('data-variable')) {
          e.preventDefault()
          nextSibling.remove()
          handleInput()
          return
        }
      }
    }
  }

  // Insert variable at cursor
  const insertVariable = (varKey: string) => {
    if (!editorRef.current) return
    
    const varInfo = getVariableInfo(varKey)
    if (!varInfo) return

    editorRef.current.focus()
    
    const selection = window.getSelection()
    if (!selection) return

    // If no selection exists within the editor, create one at the end
    if (selection.rangeCount === 0 || !editorRef.current.contains(selection.anchorNode)) {
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    // Insert the variable text
    const newValue = value + `{{${varKey}}}`
    onChange(newValue)
  }

  const minHeight = rows * 24 // Approximate line height

  return (
    <div className="space-y-2">
      {/* Variable buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Insert:</span>
        {variables.map(v => {
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
            green: 'bg-green-100 text-green-800 hover:bg-green-200',
            purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200'
          }
          const colors = colorClasses[v.color as keyof typeof colorClasses] || colorClasses.blue
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors ${colors}`}
            >
              {v.display}
            </button>
          )
        })}
      </div>
      
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={`w-full p-3 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-auto ${className}`}
        style={{ minHeight: `${minHeight}px` }}
        data-placeholder={placeholder}
      />
      
      <p className="text-xs text-muted-foreground">
        💡 Click the colored badges above to insert variables. They'll be replaced with each member's data. "N/A" is used for missing values.
      </p>
      
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

