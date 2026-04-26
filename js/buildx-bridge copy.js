/**
 * BuildX Bridge Integration
 * 
 * This file provides the integration layer between your existing
 * WPFapplication.js chat UI and the WPF/C# backend.
 * 
 * Include this AFTER WPFapplication.js in your HTML.
 * 
 * Usage in your JS:
 *   const commands = await BuildXBridge.getCommands();
 *   const response = await BuildXBridge.chat("Hello Claude");
 */

(function() {
  'use strict';
  
  // Check if we're running in WPF (WebView2) or browser
  const isWPF = typeof window.chrome !== 'undefined' && 
                typeof window.chrome.webview !== 'undefined';
  
  // ============================================
  // BRIDGE API
  // ============================================
  
  const BuildXBridge = {
    
    /**
     * Check if running in WPF desktop app
     */
    isDesktopApp: function() {
      return isWPF;
    },
    
    /**
     * Get all available commands from encrypted database
     */
    getCommands: async function() {
      if (isWPF) {
        return await window.buildx.getCommands();
      }
      // Fallback for browser testing
      console.warn('BuildXBridge: Running in browser mode - no encrypted database');
      return [];
    },
    
    /**
     * Get a specific command
     */
    getCommand: async function(name) {
      if (isWPF) {
        return await window.buildx.getCommand(name);
      }
      return null;
    },
    
    /**
     * Save a command to the encrypted database
     */
    saveCommand: async function(command) {
      if (isWPF) {
        return await window.buildx.saveCommand(command);
      }
      console.warn('BuildXBridge: Cannot save command in browser mode');
      return false;
    },
    
    /**
     * Delete a command
     */
    deleteCommand: async function(name) {
      if (isWPF) {
        return await window.buildx.deleteCommand(name);
      }
      return false;
    },
    
    /**
     * Get a prompt template from the database
     */
    getPromptTemplate: async function(name) {
      if (isWPF) {
        return await window.buildx.getPromptTemplate(name);
      }
      return null;
    },
    
    /**
     * Send a message to Claude and get a response.
     * Extended thinking content is returned separately for you to display.
     * 
     * @param {string} userMessage - The user's message
     * @param {Object} options - Options like { thinking: true, systemPrompt: '...' }
     * @returns {Object} { text: '...', thinking: [...], usage: {...} }
     */
    chat: async function(userMessage, options = {}) {
      const messages = [{ role: 'user', content: userMessage }];
      
      if (isWPF) {
        const result = await window.buildx.callClaude(messages, options);
        return this._parseClaudeResponse(result);
      }
      
      // Browser fallback - you'd need to implement your own API call here
      console.warn('BuildXBridge: Claude API not available in browser mode');
      return {
        text: '[Browser mode - Claude API not available]',
        thinking: [],
        usage: null
      };
    },
    
    /**
     * Stream a Claude response with callback for each chunk.
     * 
     * @param {string} userMessage - The user's message
     * @param {Object} options - Options like { thinking: true }
     * @param {Function} onThinkingChunk - Called with each thinking chunk
     * @param {Function} onTextChunk - Called with each text chunk
     */
    streamChat: function(userMessage, options, onThinkingChunk, onTextChunk) {
      const messages = [{ role: 'user', content: userMessage }];
      
      if (isWPF) {
        window.buildx.streamClaude(messages, options, (chunk) => {
          if (chunk.type === 'thinking') {
            onThinkingChunk(chunk.content);
          } else if (chunk.type === 'text') {
            onTextChunk(chunk.content);
          }
        });
      } else {
        console.warn('BuildXBridge: Streaming not available in browser mode');
      }
    },
    
    /**
     * Parse Claude API response, separating thinking from text
     */
    _parseClaudeResponse: function(response) {
      if (!response || !response.content) {
        return { text: '', thinking: [], usage: null };
      }
      
      const thinking = [];
      let text = '';
      
      for (const block of response.content) {
        if (block.type === 'thinking') {
          thinking.push(block.thinking);
        } else if (block.type === 'text') {
          text += block.text;
        }
      }
      
      return {
        text: text,
        thinking: thinking,
        usage: response.usage || null
      };
    }
  };
  
  // ============================================
  // THINKING DISPLAY INTEGRATION
  // Hook into your existing thinking animation system
  // ============================================
  
  /**
   * Display thinking steps using your existing UI system.
   * This converts Claude's thinking into your step format.
   * 
   * @param {Array} thinkingBlocks - Array of thinking strings from Claude
   * @param {HTMLElement} container - Where to add the thinking UI
   */
  BuildXBridge.displayThinking = function(thinkingBlocks, container) {
    // Convert thinking text into step objects your UI expects
    const steps = [];
    
    for (const thinkingText of thinkingBlocks) {
      // Split thinking into pseudo-steps (you can customize this parsing)
      const lines = thinkingText.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        // Detect if this is an "action" line (contains file names, numbers, etc.)
        const isAction = /\.(rvt|dwg|pdf|xlsx|docx)|\+\d+|\-\d+/i.test(line);
        
        steps.push({
          text: line.trim(),
          type: isAction ? 'action' : 'think',
          // You can enhance this to extract actual file changes
          changes: isAction ? '+1' : undefined,
          filename: isAction ? 'output.rvt' : undefined
        });
      }
    }
    
    // Add "Done" step
    steps.push({ text: 'Done.', type: 'done' });
    
    return steps;
  };
  
  // ============================================
  // INTEGRATION WITH EXISTING CHAT UI
  // ============================================
  
  /**
   * Hook into the existing chat send mechanism.
   * Call this to replace the demo behavior with real Claude API calls.
   */
  BuildXBridge.enableRealMode = function() {
    if (!isWPF) {
      console.warn('BuildXBridge: Real mode requires desktop app');
      return;
    }
    
    // Find and override the chat send handler
    // This integrates with your existing View4Chat system
    const originalHandleSend = window.View4Chat?.handleChatSend;
    
    // You would hook this into your existing event system
    console.log('BuildXBridge: Real mode enabled - Claude API active');
  };
  
  // Expose globally
  window.BuildXBridge = BuildXBridge;
  
  // Log initialization
  if (isWPF) {
    console.log('BuildXBridge: Desktop mode initialized');
  } else {
    console.log('BuildXBridge: Browser mode (limited functionality)');
  }
  
})();
