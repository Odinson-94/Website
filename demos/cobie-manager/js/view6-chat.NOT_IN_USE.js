/**
 * VIEW 6: 3D Model Chat Controller
 * 
 * Handles:
 * - Conversation switching (Risers, Corridors, Plant Rooms, Clash Detection)
 * - Neural node animation workflow
 * - Thinking/Action step display (per chat-step-strategy.md)
 * - Chat input handling
 */

(function() {
  'use strict';
  
  // #region agent log - Debug helper (remove after debugging)
  function debugLog(hypothesisId, fnName, msg, data) {
    fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId,location:'view6-chat.js:'+fnName,message:msg,data,timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    console.log('[DebugLog]', hypothesisId, fnName, msg, data);
  }
  debugLog('H-INIT', 'IIFE', 'JS file loaded and executing', { isWebView2: !!(window.chrome && window.chrome.webview) });
  // #endregion
  
  // ============================================
  // CONFIGURATION
  // ============================================
  
  const TIMING = {
    nodeMove: 400,
    pause: 300,
    stepReveal: 350,
    collapse: 400
  };
  
  // ============================================
  // WEBVIEW2 BRIDGE (Revit Integration)
  // ============================================
  
  const isWebView2 = !!(window.chrome && window.chrome.webview);
  
  function sendToRevit(type, payload) {
    
    if (isWebView2) {
      const msg = JSON.stringify({ type, payload });
      console.log('[View6Chat] Posting to WebView2:', msg);
      try {
        window.chrome.webview.postMessage(msg);
      } catch (err) {
        console.error('[View6Chat] postMessage error:', err);
      }
      return true;
    }
    return false;
  }
  
  function setupRevitBridge() {
    
    if (!isWebView2) return;
    
    window.chrome.webview.addEventListener('message', function(event) {
      try {
        const data = JSON.parse(event.data);
        handleRevitMessage(data);
      } catch (e) {
        console.error('Failed to parse Revit message:', e);
      }
    });
    
    // Initialize chat with clean slate
    initializeChat();
    
    console.log('[View6Chat] Revit bridge initialized');
  }
  
  function initializeChat() {
    // Create first session on startup
    if (Object.keys(chatSessions).length === 0) {
      const sessionId = createNewSession();
      currentSessionId = sessionId;
    }
    
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) {
      chatEl.innerHTML = '';
      
      // Add welcome message
      const welcome = document.createElement('div');
      welcome.className = 'demo-msg-bot';
      welcome.innerHTML = '<p>Hello! I\'m your AI assistant for Revit MEP coordination. How can I help you today?</p>';
      chatEl.appendChild(welcome);
    }
    
    updateHistorySidebar();
  }
  
  function startNewChat() {
    
    // Save current session
    saveCurrentSession();
    
    // Tell C# to start fresh Claude conversation for new session
    if (isWebView2) {
      sendToRevit('clear', '');
    }
    
    // Create new session
    const sessionId = createNewSession();
    currentSessionId = sessionId;
    
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) {
      chatEl.innerHTML = '';
      
      // Add welcome message for new chat
      const welcome = document.createElement('div');
      welcome.className = 'demo-msg-bot';
      welcome.innerHTML = '<p>New conversation started. How can I help you?</p>';
      chatEl.appendChild(welcome);
    }
    
    updateHistorySidebar();
    
    // Focus the input
    const inputEl = document.getElementById('chatInputIndex6');
    if (inputEl) {
      inputEl.focus();
    }
    
    console.log('[View6Chat] New chat session created:', sessionId);
  }
  
  // Track thinking state
  let thinkingStartTime = null;
  let activeThinkingContainer = null;
  
  // ═══════════════════════════════════════════════════════════════
  // STREAMING: Active bot message element for token-by-token rendering
  // Created when first 'token' arrives, tokens append to it, 'response' finalizes
  // ═══════════════════════════════════════════════════════════════
  let activeStreamingMessage = null;  // The <div class="demo-msg-bot"> element
  let activeStreamingParagraph = null;  // The <p> inside it for text content
  
  // Prevent double-sends (user double-click, rapid Enter key)
  // Exposed on window for C# injected scripts
  let isSending = false;
  window.isSending = false;
  let lastSendTime = 0;
  const SEND_DEBOUNCE_MS = 500; // Minimum 500ms between sends
  
   // Helper to reset sending state and process queue
   function resetSendingState() {
     // #region agent log H-TIMING
     fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-TIMING',location:'view6-chat.js:resetSendingState',message:'Signaling ready to C#',data:{isSending,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
     // #endregion

     // Reset sending flags - we are now idle
       isSending = false;
       window.isSending = false;
     
     // CRITICAL: Signal C# that neural node is idle and we're ready for next message
     // This is the ONLY way the queue advances - ensures proper sequencing:
     // Response shown → Node dulls → Signal ready → Next message processes
     if (isWebView2) {
       sendToRevit('ready', '');
     }
   }
  
  // Step animation queue - for smooth one-by-one reveals
  let stepQueue = [];
  let isProcessingSteps = false;
  const MIN_STEP_DELAY = 400; // Min 400ms per step - matches transition duration for smooth reveals
  const MIN_TOTAL_TIME = 1000; // Min 1 second total

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE QUEUE VIEW - Visual queue at bottom of chat
  // Shows queued messages with preview + cancel buttons
  // ═══════════════════════════════════════════════════════════════
  
  class MessageQueueView {
    constructor(chatContainer) {
      this.chatContainer = chatContainer;
      this.queuedMessages = [];
      this.containerEl = null;
    }
    
    // Add message to visual queue
    addMessage(text) {
      const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      this.queuedMessages.push({ id, text, addedAt: Date.now() });
      this.render();
      return id;
    }
    
    // Remove/cancel a message - clears ALL queued messages (keeps JS and C# in sync)
    removeMessage(id) {
      const beforeLen = this.queuedMessages.length;
      
      // #region agent log H-CANCEL
      fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-CANCEL',location:'view6-chat.js:removeMessage',message:'JS cancel - clearing all queued',data:{cancelledId:id,beforeLen},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      
      // Clear ALL from JS (C# queue doesn't support removing specific items)
      this.queuedMessages = [];
      this.render();
      
      // Tell C# to clear its queue too
      if (isWebView2) {
        sendToRevit('clear_queue', '');
      }
    }
    
    // Clear all queued messages
    clearAll() {
      const beforeLen = this.queuedMessages.length;
      this.queuedMessages = [];
      this.render();
      
      // Tell C# to clear its queue too
      if (isWebView2) {
        sendToRevit('clear_queue', '');
      }
    }
    
    // Render the queue UI
    render() {
      // Remove existing container
      if (this.containerEl) {
        this.containerEl.remove();
        this.containerEl = null;
      }
      
      // Don't render if no messages
      if (this.queuedMessages.length === 0) return;
      
      // Create container
      this.containerEl = document.createElement('div');
      this.containerEl.className = 'message-queue-container';
      
      // Header
      const header = document.createElement('div');
      header.className = 'message-queue-header';
      header.innerHTML = `
        <span class="message-queue-title">${this.queuedMessages.length} message${this.queuedMessages.length > 1 ? 's' : ''} queued</span>
        <button class="message-queue-clear">Clear all</button>
      `;
      header.querySelector('.message-queue-clear').addEventListener('click', () => this.clearAll());
      this.containerEl.appendChild(header);
      
      // Message list
      const list = document.createElement('div');
      list.className = 'message-queue-list';
      
      this.queuedMessages.forEach((msg, index) => {
        const item = document.createElement('div');
        item.className = 'queued-message-item';
        item.innerHTML = `
          <div class="queued-message-preview">
            <span class="queued-message-icon">${index + 1}</span>
            <span class="queued-message-text">${escapeHtml(msg.text)}</span>
            <span class="queued-message-status">${index === 0 && this.isProcessing ? 'sending...' : 'waiting'}</span>
          </div>
          <div class="queued-message-actions">
            <button class="queue-action-btn cancel" data-id="${msg.id}">Cancel</button>
          </div>
        `;
        
        item.querySelector('.queue-action-btn.cancel').addEventListener('click', (e) => {
          this.removeMessage(e.target.dataset.id);
        });
        
        list.appendChild(item);
      });
      
      this.containerEl.appendChild(list);
      
      // Insert BELOW neural node wrapper (after it, before chat input)
      const nodeWrapper = document.querySelector('.chat-persistent-node-wrapper');
      const chatMain = document.querySelector('.demo-chat-main');
      
      if (nodeWrapper && chatMain) {
        // Insert directly after the neural node wrapper
        nodeWrapper.insertAdjacentElement('afterend', this.containerEl);
      } else if (chatMain) {
        // Fallback: insert before input row
        const inputRow = document.querySelector('.demo-chat-input-row');
        if (inputRow) {
          chatMain.insertBefore(this.containerEl, inputRow);
        } else {
          chatMain.appendChild(this.containerEl);
        }
      } else if (this.chatContainer) {
        // Final fallback: append to chat container
        this.chatContainer.appendChild(this.containerEl);
      }
    }
  }
  
  // Global message queue view instance - exposed on window for C# access
  let messageQueueView = null;
  window.messageQueueView = null;
  
  // Initialize queue view when chat loads
  // Exposed on window for C# injected scripts
  function initMessageQueueView() {
    const chatEl = document.getElementById('chatMessagesIndex6');
    
    if (chatEl && !messageQueueView) {
      messageQueueView = new MessageQueueView(chatEl);
      window.messageQueueView = messageQueueView; // Expose for C# injected scripts
    }
    return messageQueueView;
  }
  // Expose for C# injected scripts
  window.initMessageQueueView = initMessageQueueView;

  function handleRevitMessage(data) {
    debugLog('O', 'handleRevitMessage', 'Received message from Revit', { type: data.type, hasMessage: !!data.message });
    // #endregion
    
    const chatEl = document.getElementById('chatMessagesIndex6');
    const nodeEl = document.getElementById('chatPersistentNodeIndex6');
    
    if (!chatEl) return;
    
    switch (data.type) {
      case 'thinking':
        
        // Reset step queue for new thinking session
        stepQueue = [];
        isProcessingSteps = false;
        window._thinkingBuffer = '';
        
        // Reset streaming message state for new response
        activeStreamingMessage = null;
        activeStreamingParagraph = null;
        window._tokenCount = 0;
        
        // Claude started thinking - start node animation
        thinkingStartTime = Date.now();
        
        // FIX: Create thinking container IMMEDIATELY so thoughts don't get dropped
        // The animation can happen in parallel - the container must be ready for thoughts
        activeThinkingContainer = createThinkingIndicator(chatEl);
        
        if (nodeEl) {
          
          // Step 1: Start glow FIRST
          nodeEl.classList.add('processing');
          
          // Step 2: After brief glow, move LEFT (animation runs in parallel with thought collection)
          setTimeout(() => {
            nodeEl.classList.add('left');
          }, 150); // Brief delay to let glow be visible first
          
        } else {
        }
        break;
        
       case 'thought':
         // Queue the thought for animated reveal
        if (activeThinkingContainer && data.message) {
          stepQueue.push(data.message);
          processStepQueue();
        } else {
        }
        break;
      
      case 'thinking_delta':
        // Stream Claude's internal reasoning as individual step bullets.
        // Accumulate text in a buffer; when we see a newline, flush as a step.
        if (activeThinkingContainer && data.message) {
          if (!window._thinkingBuffer) window._thinkingBuffer = '';
          window._thinkingBuffer += data.message;
          
          // Split on newlines — each complete line becomes a step bullet
          const lines = window._thinkingBuffer.split('\n');
          // Keep the last (possibly incomplete) fragment in the buffer
          window._thinkingBuffer = lines.pop();
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
              // Strip leading numbering like "1. " or "- " for cleaner bullets
              const cleaned = trimmed.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '');
              if (cleaned.length > 0) {
                stepQueue.push(cleaned);
              }
            }
          }
          if (stepQueue.length > 0) processStepQueue();
        }
        break;
        
      case 'token':
        // Flush any remaining thinking buffer as a final step
        if (window._thinkingBuffer && window._thinkingBuffer.trim().length > 0 && activeThinkingContainer) {
          stepQueue.push(window._thinkingBuffer.trim());
          processStepQueue();
          window._thinkingBuffer = '';
        }
        // ═══════════════════════════════════════════════════════════════
        // STREAMING: Append text token to active bot message in real-time
        // First token creates the message bubble; subsequent tokens append
        // ═══════════════════════════════════════════════════════════════
        // #region agent log H4: Log token arrival in JS
        if (!window._tokenCount) window._tokenCount = 0;
        window._tokenCount++;
        if (window._tokenCount <= 3) { fetch('http://127.0.0.1:7243/ingest/289e3919-88dc-4289-b64f-1fac50a5f23b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b5a13'},body:JSON.stringify({sessionId:'0b5a13',hypothesisId:'H4',location:'view6-chat.js:token',message:'Token received in JS #' + window._tokenCount,data:{tokenText:data.message?.substring?.(0,30),hasActiveMessage:!!activeStreamingMessage,chatElExists:!!chatEl},timestamp:Date.now()})}).catch(()=>{}); }
        // #endregion
        if (data.message) {
          if (!activeStreamingMessage) {
            // Create the bot message bubble on first token
            activeStreamingMessage = document.createElement('div');
            activeStreamingMessage.className = 'demo-msg-bot';
            activeStreamingMessage.style.opacity = '0';
            activeStreamingMessage.style.transform = 'translateY(12px) scale(0.98)';
            
            activeStreamingParagraph = document.createElement('p');
            activeStreamingMessage.appendChild(activeStreamingParagraph);
            chatEl.appendChild(activeStreamingMessage);
            
            // Animate in
            activeStreamingMessage.offsetHeight; // Force reflow
            activeStreamingMessage.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            activeStreamingMessage.style.opacity = '1';
            activeStreamingMessage.style.transform = 'translateY(0) scale(1)';
          }
          
          // Append the token text
          if (activeStreamingParagraph) {
            activeStreamingParagraph.textContent += data.message;
          }
          
          // Auto-scroll to keep the streaming text in view
          chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
        }
        break;
        
       case 'response':
        // #region agent log UI_RESPONSE: Log response content
        fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'view6-chat.js:response',message:'Processing response',data:{messageExists:!!data.message,messagePreview:data.message?.substring?.(0,100),messageLength:data.message?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'UI_RESPONSE'})}).catch(()=>{});
        // #endregion
         // Claude response - end animation and display
        // Correct sequence:
        // 1. Wait for steps to finish
        // 2. Fold up steps smoothly
        // 3. Show response message
        // 4. THEN move node back right (still glowing)
        // 5. Wait for node to ARRIVE (transitionend)
        // 6. Stay glowing for a moment
        // 7. Dull down
        (async () => {
          // Wait for step queue to finish with minimum time
          const elapsedTime = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
          const remainingMinTime = Math.max(0, MIN_TOTAL_TIME - elapsedTime);
          
          // Wait for any remaining steps in the queue to animate
          while (stepQueue.length > 0 || isProcessingSteps) {
            await sleep(50);
          }
          
          // Ensure minimum total animation time
          if (remainingMinTime > 0) {
            await sleep(remainingMinTime);
          }
          
          const thinkDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
          
          // Step 1: Fold up thinking indicator smoothly
          if (activeThinkingContainer) {
            finishThinkingIndicator(activeThinkingContainer, thinkDuration);
            activeThinkingContainer = null;
          }
          
          // Wait for fold animation to complete
          await sleep(500);
          
          // Step 2: Show response message FIRST
          // #region agent log UI_RESPONSE2
          fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'view6-chat.js:response:display',message:'About to display message',data:{hasMessage:!!data.message,chatElExists:!!chatEl,wasStreamed:!!activeStreamingMessage},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'UI_RESPONSE2'})}).catch(()=>{});
          // #endregion
          
          // If we already streamed tokens, the message is already in the DOM
          // Just finalize it. Otherwise, add the full response as a new message.
          if (activeStreamingMessage) {
            // Streaming was used — convert plain text to markdown HTML
            if (activeStreamingParagraph) {
              activeStreamingParagraph.innerHTML = renderMarkdown(activeStreamingParagraph.textContent);
            }
            chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
            activeStreamingMessage = null;
            activeStreamingParagraph = null;
          } else if (data.message) {
            // Non-streaming fallback (e.g., orchestrator path, tool results)
            addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p>' + renderMarkdown(data.message) + '</p>');
            chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
          }
          
          // Wait for message animation to settle
          await sleep(600);
          
          // Step 3: THEN move node back to right (still glowing)
          if (nodeEl) {
            
            // Use transitionend to wait for node to arrive
            const nodeArrivedRight = new Promise(resolve => {
              const onArrived = (e) => {
                if (e.propertyName !== 'margin-left') return;
                nodeEl.removeEventListener('transitionend', onArrived);
                resolve();
              };
              nodeEl.addEventListener('transitionend', onArrived);
            });
            
            nodeEl.classList.remove('left');
            
            // Wait for node to physically arrive at right position
            await nodeArrivedRight;
            
            // Step 4: Stay glowing for a moment after arriving
            await sleep(800);
            
            // Step 5: Dull down smoothly (remove processing/glow)
            nodeEl.classList.remove('processing');
            // #region agent log H-TIMING
            fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-TIMING',location:'view6-chat.js:response',message:'Node went DULL',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
            // #endregion
          }
          
          thinkingStartTime = null;
          resetSendingState(); // Reset sending guard - ready for next message
        })();
        break;
        
      case 'error':
        // End animation on error
        if (nodeEl) {
          nodeEl.classList.remove('processing');
          nodeEl.classList.remove('left');
        }
        if (activeThinkingContainer) {
          activeThinkingContainer.remove();
          activeThinkingContainer = null;
        }
        addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p style="color:#ff6b6b;">⚠️ ' + escapeHtml(data.message || 'Error') + '</p>');
        chatEl.scrollTop = chatEl.scrollHeight;
        thinkingStartTime = null;
        resetSendingState(); // Reset sending guard on error
        break;
        
      case 'status':
        console.log('[View6Chat] Status:', data.message);
        break;

      case 'warmup_status': {
        const banner = document.getElementById('buildxWarmupBanner');
        if (banner) {
          const msg = data.message || '';
          if (!msg || /ready/i.test(msg)) {
            banner.style.display = 'none';
            banner.textContent = '';
          } else {
            banner.style.display = 'block';
            banner.textContent = msg;
          }
        }
        console.log('[View6Chat] warmup_status:', data.message);
        break;
      }
        
      case 'suggestions':
        // #region agent log SUGGESTIONS
        fetch('http://127.0.0.1:7243/ingest/48527b0a-4480-4636-ae40-f6f2f93fa549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'view6-chat.js:suggestions',message:'Processing suggestions',data:{hasCommands:!!data.commands,commandCount:data.commands?.length,hasMessage:!!data.message,originalQuery:data.originalQuery},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUGGESTIONS'})}).catch(()=>{});
        // #endregion
        // "Did you mean?" with command buttons - keep steps visible (fold them)
        (async () => {
          // Wait for step queue to finish
          while (stepQueue.length > 0 || isProcessingSteps) {
            await sleep(50);
          }
          
          // Fold up thinking indicator (keep visible)
          if (activeThinkingContainer) {
            const thinkDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
            finishThinkingIndicator(activeThinkingContainer, thinkDuration);
            activeThinkingContainer = null;
          }
          
          await sleep(500);
          
          // Reset node animation
          if (nodeEl) {
            nodeEl.classList.remove('processing');
            nodeEl.classList.remove('left');
          }
          
          // Show suggestions below the folded steps
          showCommandSuggestions(chatEl, data.commands, data.originalQuery, data.message);
          thinkingStartTime = null;
          resetSendingState();
        })();
        break;
        
      case 'clarify':
        // Too many 50% matches - ask user to be more specific - keep steps visible
        (async () => {
          while (stepQueue.length > 0 || isProcessingSteps) {
            await sleep(50);
          }
          
          if (activeThinkingContainer) {
            const thinkDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
            finishThinkingIndicator(activeThinkingContainer, thinkDuration);
            activeThinkingContainer = null;
          }
          
          await sleep(500);
          
          if (nodeEl) {
            nodeEl.classList.remove('processing');
            nodeEl.classList.remove('left');
          }
          
          showClarifyMessage(chatEl, data.message, data.suggestions);
          thinkingStartTime = null;
          resetSendingState();
        })();
        break;
        
      case 'commandOrder':
        // Multi-step workflow - show step-by-step command picker - keep steps visible
        (async () => {
          while (stepQueue.length > 0 || isProcessingSteps) {
            await sleep(50);
          }
          
          if (activeThinkingContainer) {
            const thinkDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
            finishThinkingIndicator(activeThinkingContainer, thinkDuration);
            activeThinkingContainer = null;
          }
          
          await sleep(500);
          
          if (nodeEl) {
            nodeEl.classList.remove('processing');
            nodeEl.classList.remove('left');
          }
          
          showCommandOrder(chatEl, data);
          thinkingStartTime = null;
          resetSendingState();
        })();
        break;
        
      case 'fallback':
        // No matches found - keep steps visible
        (async () => {
          while (stepQueue.length > 0 || isProcessingSteps) {
            await sleep(50);
          }
          
          if (activeThinkingContainer) {
            const thinkDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
            finishThinkingIndicator(activeThinkingContainer, thinkDuration);
            activeThinkingContainer = null;
          }
          
          await sleep(500);
          
          if (nodeEl) {
            nodeEl.classList.remove('processing');
            nodeEl.classList.remove('left');
          }
          
          addMessageWithAnimation(chatEl, 'demo-msg-bot', '<p style="color:#888;">🤔 ' + escapeHtml(data.message || 'No matching command found.') + '</p>');
          chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
          thinkingStartTime = null;
          resetSendingState();
        })();
        break;
        
      case 'prompt_missing':
        // No keywords for this command - show prompt engineering box - keep steps visible
        (async () => {
          while (stepQueue.length > 0 || isProcessingSteps) {
            await sleep(50);
          }
          
          if (activeThinkingContainer) {
            const thinkDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0;
            finishThinkingIndicator(activeThinkingContainer, thinkDuration);
            activeThinkingContainer = null;
          }
          
          await sleep(500);
          
          if (nodeEl) {
            nodeEl.classList.remove('processing');
            nodeEl.classList.remove('left');
          }
          
          showPromptEngineeringBox(chatEl, data.commandName, data.commandClass);
          thinkingStartTime = null;
          resetSendingState();
        })();
        break;
        
      case 'prompt_saved':
        // Confirm prompt was saved
        var keywordsLine = data.keywords ? '<p style="font-size:12px;color:#888;">Keywords: ' + escapeHtml(data.keywords) + '</p>' : '';
        addMessageWithAnimation(chatEl, 'demo-msg-bot', 
          '<p style="color:#4ade80;">✓ Prompt saved for <strong>' + escapeHtml(data.commandName || 'Command') + '</strong></p>' + keywordsLine);
        chatEl.scrollTop = chatEl.scrollHeight;
        resetSendingState(); // Reset sending guard
        break;
        
      case 'task_list':
        // Render task panel between tabs and chat messages, matching thinking container style
        if (data.tasks && Array.isArray(data.tasks)) {
          const completed = data.tasks.filter(t => t.status === 'completed').length;
          const failed = data.tasks.filter(t => t.status === 'failed').length;
          const total = data.tasks.length;
          const allDone = completed + failed === total;
          const currentTask = data.tasks.find(t => t.status === 'in_progress');
          
          let panel = document.getElementById('stickyTaskPanel');
          if (!panel) {
            panel = document.createElement('div');
            panel.id = 'stickyTaskPanel';
            // Match thinking-container exactly: same background, border, radius, padding, margin
            panel.style.cssText = 'background:#2a2a2a;border:1px solid #3a3a3a;border-radius:12px;padding:6px 10px;margin:8px 12px 0 12px;font-family:\'Inter\',sans-serif;cursor:pointer;overflow:hidden;transition:all 0.3s ease;flex-shrink:0;';
            
            // Insert between design-options-bar and chatEl
            const chatMain = chatEl.parentNode;
            chatMain.insertBefore(panel, chatEl);
            
            // Toggle on click
            panel.addEventListener('click', function(e) {
              e.stopPropagation();
              const isCollapsed = panel.dataset.collapsed === 'true';
              const listEl = panel.querySelector('.task-items');
              if (isCollapsed) {
                panel.dataset.collapsed = 'false';
                if (listEl) listEl.style.display = '';
              } else {
                panel.dataset.collapsed = 'true';
                if (listEl) listEl.style.display = 'none';
              }
            });
          }
          
          // Header: matches thinking-header layout
          let countText = completed + '/' + total;
          let html = '<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;">';
          html += '<div style="display:flex;align-items:center;gap:8px;">';
          html += '<div style="width:7px;height:7px;border-radius:50%;background:' + (allDone ? '#4CD964' : '#4a9bb8') + ';flex-shrink:0;"></div>';
          html += '<span style="font-family:\'Inter Display\',\'Inter\',sans-serif;font-size:10px;font-weight:300;color:#777;">' + countText + ' tasks</span>';
          // Show current task name when collapsed
          if (currentTask && panel.dataset.collapsed === 'true') {
            html += '<span style="font-size:0.60rem;font-weight:200;color:#999;margin-left:4px;">— ' + escapeHtml(currentTask.label) + '</span>';
          }
          html += '</div>';
          html += '<span class="task-panel-chevron" style="font-size:10px;color:#555;transform:rotate(' + (panel.dataset.collapsed === 'true' ? '180' : '0') + 'deg);transition:transform 0.2s ease;">⌃</span>';
          html += '</div>';
          
          // Task list: matches steps-list styling
          const isCollapsed = panel.dataset.collapsed === 'true';
          html += '<ul class="task-items" style="list-style:none;margin:6px 0 0 0;padding:0 0 0 7px;font-size:0.60rem;font-weight:200;line-height:1.5;position:relative;' + (isCollapsed ? 'display:none;' : '') + '">';
          for (const task of data.tasks) {
            let dotBg = '#666';
            let textStyle = 'color:#999;';
            if (task.status === 'completed') { dotBg = '#4CD964'; textStyle = 'color:#666;text-decoration:line-through;opacity:0.5;'; }
            else if (task.status === 'failed') { dotBg = '#f85149'; textStyle = 'color:#f85149;'; }
            else if (task.status === 'in_progress') { dotBg = '#4a9bb8'; textStyle = 'color:#ccc;font-weight:400;'; }
            
            html += '<li style="padding:4px 0;padding-left:14px;position:relative;display:flex;align-items:flex-start;' + textStyle + '">';
            // Vertical line (matches .steps-list li::before)
            html += '<div style="position:absolute;left:3px;top:0;bottom:0;width:1px;background:#444;"></div>';
            // Dot node (matches .step-icon)
            html += '<div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:' + dotBg + ';z-index:1;"></div>';
            html += '<span>' + escapeHtml(task.label) + '</span>';
            html += '</li>';
          }
          html += '</ul>';
          
          panel.innerHTML = html;
          
          // Auto-collapse after 5s on first render or update
          if (!isCollapsed) {
            clearTimeout(panel._collapseTimer);
            panel._collapseTimer = setTimeout(() => {
              panel.dataset.collapsed = 'true';
              const listEl = panel.querySelector('.task-items');
              if (listEl) listEl.style.display = 'none';
              // Re-render to show current task in header
              if (typeof handleRevitMessage === 'function') {
                // Just update innerHTML directly for collapsed state
                const chevron = panel.querySelector('.task-panel-chevron');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
              }
            }, 5000);
          }
          
          chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
        }
        break;
        
      case 'memory_updated':
        // Toast notification when Claude updates memory
        if (data.target) {
          const toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;bottom:60px;right:16px;background:#2a2a2a;border:1px solid rgba(74,155,184,0.3);border-radius:6px;padding:6px 12px;font-family:\'Inter\',sans-serif;font-size:0.66rem;font-weight:400;color:#999;z-index:100;opacity:0;transform:translateY(8px);transition:opacity 0.3s ease,transform 0.3s ease;display:flex;align-items:center;gap:6px;';
          const scope = data.scope === 'domain' ? '📂' : data.scope === 'chat' ? '💬' : '💾';
          toast.innerHTML = scope + ' <span style="color:#4a9bb8;">' + escapeHtml(data.target) + '</span> updated';
          document.body.appendChild(toast);
          requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
          setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)'; setTimeout(() => toast.remove(), 300); }, 3000);
        }
        break;
    }
  }
  
  /**
   * Show "Did you mean?" command suggestions with shiny buttons
   * These appear OUTSIDE the message context as pressable action buttons
   * @param {string} [customMessage] - Optional custom message to display
   */
  function showCommandSuggestions(chatEl, commands, originalQuery, customMessage) {
    
    const container = document.createElement('div');
    container.className = 'suggestions-container'; // NOT demo-msg-bot - standalone
    
    const headerText = customMessage || 'Did you mean one of these?';
    let html = `<p>${escapeHtml(headerText)}</p><div class="command-suggestions">`;
    
    commands.forEach((cmd, index) => {
      const confidence = cmd.confidence ? Math.round(cmd.confidence * 100) : 50;
      const keywords = cmd.keywords || [];
      const isPrimary = cmd.isPrimary === true;
      
      // Clean command name - remove "Command" suffix for display
      let displayName = cmd.name || 'Unknown';
      displayName = displayName.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
      
      const primaryClass = isPrimary ? ' primary' : '';
      
      html += `
        <button class="suggestion-btn${primaryClass}" data-command-id="${escapeHtml(cmd.id || cmd.name)}" data-index="${index}" data-confidence="${confidence}%">
          <span class="suggestion-name">${escapeHtml(displayName)}</span>
        </button>
      `;
    });
    
    html += '</div><p class="suggestion-hint">Tap a command to run it, or try describing your task differently.</p>';
    container.innerHTML = html;
    
    // Add click handlers for suggestion buttons
    container.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmdId = btn.dataset.commandId;
        
        // Visual feedback - button press animation
        btn.style.transform = 'scale(0.98)';
        btn.style.opacity = '0.8';
        
        setTimeout(() => {
          sendToRevit('select_command', cmdId);
          container.remove();
        }, 150);
      });
    });
    
    chatEl.appendChild(container);
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }
  
  /**
   * Show multi-step command order picker
   * User selects commands for each step, then they execute in sequence
   */
  function showCommandOrder(chatEl, data) {
    const { stepCount, workflow, steps, originalQuery, message } = data;
    
    const container = document.createElement('div');
    container.className = 'suggestions-container command-order';
    
    let html = `
      <p class="command-order-header">${escapeHtml(message || `This requires ${stepCount} steps:`)}</p>
      <p class="command-order-workflow">${escapeHtml(workflow || '')}</p>
    `;
    
    // Track selected commands per step
    const selectedCommands = {};
    
    // Render each step
    steps.forEach((step, stepIdx) => {
      const { stepNumber, stepKeyword, suggestions } = step;
      
      html += `
        <div class="step-section" data-step="${stepNumber}">
          <p class="step-label">Step ${stepNumber}: <span class="step-keyword">${escapeHtml(stepKeyword)}</span></p>
          <div class="command-suggestions step-suggestions">
      `;
      
      suggestions.forEach((cmd, cmdIdx) => {
        const confidence = cmd.confidence ? Math.round(cmd.confidence * 100) : 50;
        const isPrimary = cmd.isPrimary === true;
        
        // Clean command name
        let displayName = cmd.name || 'Unknown';
        displayName = displayName.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
        
        const primaryClass = isPrimary ? ' primary' : '';
        
        html += `
          <button class="suggestion-btn${primaryClass}" 
                  data-step="${stepNumber}" 
                  data-command-id="${escapeHtml(cmd.id || cmd.name)}" 
                  data-index="${cmdIdx}"
                  data-confidence="${confidence}%">
            <span class="suggestion-name">${escapeHtml(displayName)}</span>
          </button>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    // Execute button (disabled until all steps selected)
    html += `
      <div class="command-order-actions">
        <button class="execute-order-btn" disabled>Execute ${stepCount} Steps</button>
        <span class="selection-status">Select a command for each step</span>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Add click handlers for step buttons
    container.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stepNum = btn.dataset.step;
        const cmdId = btn.dataset.commandId;
        
        // Deselect other buttons in same step
        container.querySelectorAll(`.suggestion-btn[data-step="${stepNum}"]`).forEach(b => {
          b.classList.remove('selected');
        });
        
        // Select this button
        btn.classList.add('selected');
        selectedCommands[stepNum] = cmdId;
        
        // Check if all steps selected
        const allSelected = Object.keys(selectedCommands).length === stepCount;
        const executeBtn = container.querySelector('.execute-order-btn');
        const statusSpan = container.querySelector('.selection-status');
        
        if (allSelected) {
          executeBtn.disabled = false;
          executeBtn.classList.add('ready');
          statusSpan.textContent = 'Ready to execute';
        } else {
          executeBtn.disabled = true;
          executeBtn.classList.remove('ready');
          const remaining = stepCount - Object.keys(selectedCommands).length;
          statusSpan.textContent = `Select ${remaining} more step${remaining > 1 ? 's' : ''}`;
        }
      });
    });
    
    // Execute button handler
    const executeBtn = container.querySelector('.execute-order-btn');
    executeBtn.addEventListener('click', () => {
      if (Object.keys(selectedCommands).length !== stepCount) return;
      
      // Build ordered command list
      const orderedCommands = [];
      for (let i = 1; i <= stepCount; i++) {
        if (selectedCommands[i]) {
          orderedCommands.push(selectedCommands[i]);
        }
      }
      
      // Visual feedback
      executeBtn.disabled = true;
      executeBtn.textContent = 'Executing...';
      
      // Send command order to C#
      sendToRevit('execute_order', JSON.stringify({ commands: orderedCommands, workflow }));
      
      setTimeout(() => {
        container.remove();
      }, 300);
    });
    
    chatEl.appendChild(container);
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }
  
  /**
   * Show clarification message when too many 50% matches
   */
  function showClarifyMessage(chatEl, message, suggestions) {
    const container = document.createElement('div');
    container.className = 'suggestions-container clarify';
    
    let html = `<p style="color:#f59e0b;font-size:0.65rem;">⚠️ ${escapeHtml(message || 'Can you be more specific?')}</p>`;
    
    if (suggestions && suggestions.length > 0) {
      html += '<div class="command-suggestions">';
      suggestions.forEach((cmd, index) => {
        const confidence = cmd.confidence ? Math.round(cmd.confidence * 100) : 50;
        // Clean command name for display
        let displayName = cmd.name || 'Unknown';
        displayName = displayName.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').trim();
        
        html += `
          <button class="suggestion-btn" data-command-id="${escapeHtml(cmd.id || cmd.name)}" data-index="${index}" data-confidence="${confidence}%">
            <span class="suggestion-name">${escapeHtml(displayName)}</span>
          </button>
        `;
      });
      html += '</div>';
    }
    
    html += '<p class="suggestion-hint">Try being more specific</p>';
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmdId = btn.dataset.commandId;
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => {
          sendToRevit('select_command', cmdId);
          container.remove();
        }, 150);
      });
    });
    
    chatEl.appendChild(container);
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }
  
  /**
   * Show prompt engineering box for commands without keywords
   */
  function showPromptEngineeringBox(chatEl, commandName, commandClass) {
    // Style matches the undo/keep/function message box (files-action-btn style)
    const container = document.createElement('div');
    container.className = 'demo-msg-bot thinking-container visible';
    
    container.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node" style="background:#f59e0b;"></div>
          <span class="steps-count">No Keywords</span>
        </div>
      </div>
      <div class="files-changed-section visible" style="margin-top:8px;">
        <div class="files-changed-header">
          <span class="files-changed-count">⚠️ ${escapeHtml(commandName)}</span>
        </div>
        <div style="padding:8px 10px;font-size:0.6rem;color:#888;">
          This command has no prompt keywords. Add keywords to help AI match your requests:
        </div>
        <div style="padding:4px 10px;">
          <input type="text" class="prompt-keyword-input" 
                 style="width:100%;padding:6px 8px;font-size:0.6rem;border:1px solid #3a3a3a;border-radius:4px;background:#1a1a1a;color:#fff;"
                 placeholder="e.g., grid section, section along grid">
        </div>
        <div class="files-changed-actions" style="padding:8px 10px;display:flex;gap:8px;justify-content:flex-end;">
          <button class="files-action-btn" data-action="cancel">Cancel</button>
          <button class="files-action-btn primary" data-action="save">Save Keywords</button>
        </div>
      </div>
    `;
    
    // Handle actions
    const saveBtn = container.querySelector('[data-action="save"]');
    const cancelBtn = container.querySelector('[data-action="cancel"]');
    const input = container.querySelector('.prompt-keyword-input');
    
    saveBtn.addEventListener('click', () => {
      const keywords = input.value.trim();
      if (keywords) {
        sendToRevit('save_prompt', JSON.stringify({ commandName, commandClass, keywords }));
        container.remove();
      }
    });
    
    cancelBtn.addEventListener('click', () => {
      container.remove();
    });
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });
    
    chatEl.appendChild(container);
    chatEl.scrollTop = chatEl.scrollHeight;
    input.focus();
  }
  
  // Shiny status text phases for thinking animation
  const THINKING_PHASES = [
    'Thinking about your request...',
    'Processing...',
    'Analysing context...',
    'Planning response...',
    'Generating answer...',
    'Almost there...'
  ];
  
  function createThinkingIndicator(chatEl) {
    
    const container = document.createElement('div');
    container.className = 'thinking-container'; // Start WITHOUT visible class for smooth animation
    container.style.opacity = '0';
    container.style.transform = 'translateY(8px)';
    container.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">1 step</span>
        </div>
        <div class="steps-toggle">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list">
        <li class="visible"><span class="step-icon dot">●</span> Processing request...</li>
      </ul>
      <div class="thought-status">
        <span class="thought-status-text">Thinking about your request...</span>
      </div>
      <div class="thought-trail">
        <div class="thought-trail-header">
          <span class="thought-trail-label">Thought for <span class="thought-duration">0s</span></span>
          <span class="thought-trail-expand">▼</span>
        </div>
        <div class="thought-trail-content">
          <p>Analysing your request and preparing a response...</p>
        </div>
      </div>
    `;
    chatEl.appendChild(container);
    
    // Smooth fade-in animation for the thinking box
    requestAnimationFrame(() => {
      container.classList.add('visible');
      container.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    });
    
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
    
    // Get elements for animation
    const durationEl = container.querySelector('.thought-duration');
    const statusTextEl = container.querySelector('.thought-status-text');
    let phaseIndex = 0;
    
    // Update duration every second
    container._durationInterval = setInterval(() => {
      if (thinkingStartTime && durationEl) {
        const elapsed = Math.floor((Date.now() - thinkingStartTime) / 1000);
        durationEl.textContent = elapsed + 's';
      }
    }, 1000);
    
    // Cycle through shiny status phases every 2.5 seconds
    container._phaseInterval = setInterval(() => {
      if (statusTextEl) {
        phaseIndex = (phaseIndex + 1) % THINKING_PHASES.length;
        statusTextEl.textContent = THINKING_PHASES[phaseIndex];
      }
    }, 2500);
    
    return container;
  }
  
  /**
   * Process step queue with animated reveals - one by one with delays
   * Matches the website's View 6 animation style
   */
  async function processStepQueue() {
    if (isProcessingSteps) return;
    isProcessingSteps = true;
    
    while (stepQueue.length > 0 && activeThinkingContainer) {
      const thought = stepQueue.shift();
      
      // Add step with animation
      addStepToThinkingIndicatorAnimated(activeThinkingContainer, thought);
      
      // Wait minimum delay before next step
      await sleep(MIN_STEP_DELAY);
    }
    
    isProcessingSteps = false;
  }
  
  // renderTaskList removed — task_list now renders as a bot message bubble directly in handleRevitMessage

  /**
   * Add a step to the thinking indicator with smooth animation
   */
  function addStepToThinkingIndicatorAnimated(container, thought) {
    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('.steps-count');
    const statusTextEl = container.querySelector('.thought-status-text');
    const trailContent = container.querySelector('.thought-trail-content');
    const toggle = container.querySelector('.steps-toggle');
    
    if (!stepsList || !thought) return;
    
    // Auto-expand list when steps start coming in
    if (toggle && !toggle.classList.contains('expanded')) {
      toggle.classList.add('expanded');
      stepsList.classList.add('expanded');
    }
    
    // Create step element with smooth animation
    // NOTE: Must set display:flex inline because CSS has display:none by default
    // and display cannot be transitioned - it would skip the animation
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'flex-start';
    li.style.opacity = '0';
    li.style.transform = 'translateY(8px)';
    li.innerHTML = `<span class="step-icon dot">●</span> ${escapeHtml(thought)}`;
    stepsList.appendChild(li);
    
    // Force browser to calculate styles (layout thrash ensures initial state is painted)
    li.offsetHeight;
    
    // NOW add transition and animate
    li.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    li.classList.add('visible'); // For CSS color styling only
        li.style.opacity = '1';
    li.style.transform = 'translateY(0)';
    
    // Update count with animation
    const count = stepsList.querySelectorAll('li').length;
    if (stepsCount) {
      stepsCount.textContent = `${count} step${count !== 1 ? 's' : ''}`;
    }
    
    // Update status text with shiny effect
    if (statusTextEl) {
      statusTextEl.textContent = thought;
    }
    
    // Add to thought trail
    if (trailContent) {
      // Clear initial dummy text if present
      if (trailContent.innerHTML.includes('Analysing your request')) {
        trailContent.innerHTML = '';
      }
      const p = document.createElement('p');
      p.style.opacity = '0';
      p.style.transition = 'opacity 0.2s ease';
      p.textContent = thought;
      trailContent.appendChild(p);
      requestAnimationFrame(() => {
        p.style.opacity = '1';
      });
    }
    
    // Scroll chat smoothly
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
    }
  }
  
  function addStepToThinkingIndicator(container, thought) {
    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('.steps-count');
    const statusTextEl = container.querySelector('.thought-status-text');
    const trailContent = container.querySelector('.thought-trail-content');
    
    if (!stepsList || !thought) {
      return;
    }
    
    // Add to steps list
    const li = document.createElement('li');
    li.className = 'visible';
    li.innerHTML = `<span class="step-icon dot">●</span> ${escapeHtml(thought)}`;
    stepsList.appendChild(li);
    
    // Update count
    const count = stepsList.querySelectorAll('li').length;
    if (stepsCount) stepsCount.textContent = `${count} step${count !== 1 ? 's' : ''}`;
    
    // Update status text
    if (statusTextEl) statusTextEl.textContent = thought;
    
    // Add to thought trail
    if (trailContent) {
      // Clear initial dummy text if present
      if (trailContent.innerHTML.includes('Analysing your request')) {
        trailContent.innerHTML = '';
      }
      const p = document.createElement('p');
      p.textContent = thought;
      trailContent.appendChild(p);
    }
    
    // Scroll chat
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  }
  
  function finishThinkingIndicator(container, durationMs) {
    // Stop intervals
    if (container._durationInterval) {
      clearInterval(container._durationInterval);
    }
    if (container._phaseInterval) {
      clearInterval(container._phaseInterval);
    }
    
    // Update final duration
    const durationEl = container.querySelector('.thought-duration');
    if (durationEl) {
      durationEl.textContent = formatDuration(durationMs);
    }
    
    // Update status text to "Done"
    const statusTextEl = container.querySelector('.thought-status-text');
    if (statusTextEl) {
      statusTextEl.textContent = 'Done ✓';
      // Remove shine animation for completed state
      statusTextEl.style.animation = 'none';
      statusTextEl.style.background = '#22863a';
      statusTextEl.style.webkitBackgroundClip = 'text';
      statusTextEl.style.backgroundClip = 'text';
    }
    
    // Mark as complete
    container.classList.add('complete');
    const header = container.querySelector('.thinking-header');
    if (header) header.classList.add('done');
    
    // Update steps count - use ACTUAL count, don't reset to 1
    const stepsList = container.querySelector('.steps-list');
    const stepsCount = container.querySelector('.steps-count');
    if (stepsCount && stepsList) {
      const actualCount = stepsList.querySelectorAll('li').length;
      stepsCount.textContent = `${actualCount} step${actualCount !== 1 ? 's' : ''}`;
    }
    
    // Collapse the steps list
    const toggle = container.querySelector('.steps-toggle');
    if (toggle) toggle.classList.remove('expanded');
    if (stepsList) stepsList.classList.remove('expanded');
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    // Bold: **text** → <strong>text</strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* → <em>text</em>
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Inline code: `text` → <code>text</code>
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:0.9em;font-family:\'Consolas\',monospace;">$1</code>');
    // Note stored: pattern → styled card
    html = html.replace(/(?:<strong>)?Note stored:?(?:<\/strong>)?:?\s*(.+?)(?:<br>|$)/gi, 
      '<div style="background:rgba(74,155,184,0.08);border-left:2px solid #4a9bb8;padding:4px 8px;margin:4px 0;border-radius:0 4px 4px 0;font-family:\'Inter\',sans-serif;font-size:0.66rem;line-height:1.6;"><span style="color:#4a9bb8;font-weight:500;">🔖 Noted:</span> $1</div>');
    // Memory updated pattern
    html = html.replace(/(?:<strong>)?Memory updated:?(?:<\/strong>)?:?\s*(.+?)(?:<br>|$)/gi,
      '<div style="background:rgba(76,217,100,0.08);border-left:2px solid #4CD964;padding:4px 8px;margin:4px 0;border-radius:0 4px 4px 0;font-family:\'Inter\',sans-serif;font-size:0.66rem;line-height:1.6;"><span style="color:#4CD964;font-weight:500;">💾 Memory:</span> $1</div>');
    // Numbered lists: "1. text" at start of line → proper list items with paragraph breaks
    html = html.replace(/(?:^|<br>)(\d+)\.\s+(.+?)(?=<br>\d+\.|<br>$|$)/g, 
      '<div style="display:flex;gap:6px;padding:3px 0;"><span style="color:#4a9bb8;font-weight:500;flex-shrink:0;">$1.</span><span>$2</span></div>');
    // Bullet lists: "- text" at start of line
    html = html.replace(/(?:^|<br>)[-•]\s+(.+?)(?=<br>[-•]|<br>$|$)/g,
      '<div style="display:flex;gap:6px;padding:2px 0;"><span style="color:#666;flex-shrink:0;">•</span><span>$1</span></div>');
    // Line breaks (remaining)
    html = html.replace(/\n/g, '<br>');
    return html;
  }
  
  // ============================================
  // STATE
  // ============================================
  
  let activeConversation = 'risers';
  let isAnimating = false;
  
  // Track completed state and chat content per conversation (persists until page refresh)
  const conversationStates = {};  // { conversationKey: { completed: bool, chatHTML: string } }
  
  // ============================================
  // CHAT SESSION MANAGEMENT
  // Real Claude conversations - no demo content
  // ============================================
  
  // Active chat sessions (persisted during session)
  const chatSessions = {};
  let currentSessionId = null;
  let sessionCounter = 0;
  
  function generateSessionId() {
    sessionCounter++;
    return 'chat_' + Date.now() + '_' + sessionCounter;
  }
  
  function createNewSession() {
    const sessionId = generateSessionId();
    const now = new Date();
    chatSessions[sessionId] = {
      id: sessionId,
      title: 'New Chat',
      messages: [],
      created: now,
      lastUpdated: now
    };
    return sessionId;
  }
  
  function saveCurrentSession() {
    if (!currentSessionId || !chatSessions[currentSessionId]) return;
    
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl) {
      chatSessions[currentSessionId].messagesHtml = chatEl.innerHTML;
      chatSessions[currentSessionId].lastUpdated = new Date();
    }
  }
  
  function loadSession(sessionId) {
    if (!chatSessions[sessionId]) return;
    
    // Save current session first
    saveCurrentSession();
    
    currentSessionId = sessionId;
    const session = chatSessions[sessionId];
    
    const chatEl = document.getElementById('chatMessagesIndex6');
    if (chatEl && session.messagesHtml) {
      chatEl.innerHTML = session.messagesHtml;
    } else if (chatEl) {
      chatEl.innerHTML = '';
    }
    
    updateHistorySidebar();
  }
  
  function updateHistorySidebar() {
    const historyContainer = document.getElementById('chatHistoryIndex6');
    if (!historyContainer) return;
    
    // Clear existing items
    historyContainer.innerHTML = '';
    
    // Sort sessions by last updated (newest first)
    const sortedSessions = Object.values(chatSessions).sort((a, b) => 
      new Date(b.lastUpdated) - new Date(a.lastUpdated)
    );
    
    sortedSessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'demo-history-item' + (session.id === currentSessionId ? ' active' : '');
      item.setAttribute('data-session-id', session.id);
      item.innerHTML = `
        <div class="demo-history-item-title">${escapeHtml(session.title)}</div>
        <div class="demo-history-item-preview">${formatTimeAgo(session.lastUpdated)}</div>
      `;
      historyContainer.appendChild(item);
    });
  }
  
  function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }
  
  function updateSessionTitle(sessionId, firstMessage) {
    if (!chatSessions[sessionId]) return;
    // Use first 30 chars of first message as title
    const title = firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
    chatSessions[sessionId].title = title;
    updateHistorySidebar();
  }
  
  // No demo content - empty conversations object
  const conversations = {};
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function getElements() {
    return {
      chatMessages: document.getElementById('chatMessagesIndex6'),
      persistentNode: document.getElementById('chatPersistentNodeIndex6'),
      gifSection: document.getElementById('gifSectionIndex6'),
      chatInput: document.getElementById('chatInputIndex6'),
      chatSend: document.getElementById('chatSendIndex6')
    };
  }
  
  // Format duration as "Xm Ys" or "Xs"
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
  
  // Get status text based on step type
  function getStatusForStep(step) {
    if (!step) return '';
    switch (step.type) {
      case 'think':
        return 'Thinking...';
      case 'action':
        return 'Generating 3D model...';
      case 'error':
        return 'Stopped.';
      case 'done':
        return 'Complete.';
      default:
        return 'Processing...';
    }
  }
  
  /**
   * Build step HTML from step object
   * Per chat-step-strategy.md:
   * - think: grey dot, no +/-, no filename
   * - action: pencil icon, +/- in box, filename in light font
   * - done: green check
   */
  function buildStepHtml(step, liClasses = '') {
    let iconClass = 'dot';
    let iconChar = '';
    
    if (step.type === 'done') {
      iconClass = 'check';
    } else if (step.type === 'action') {
      iconClass = 'edit';
      iconChar = '✎';
    } else if (step.type === 'error') {
      iconClass = 'error';
      iconChar = '✗';
    }
    
    let changesHtml = '';
    if (step.changes) {
      const changeClass = step.changes.startsWith('-') ? 'removed' : (step.changes.startsWith('~') ? 'modified' : 'added');
      changesHtml = `<span class="step-changes"><span class="changes-box"><span class="${changeClass}">${step.changes}</span></span><span class="filename">${step.filename || ''}</span></span>`;
    }
    
    return `<li class="${liClasses}"><span class="step-icon ${iconClass}">${iconChar}</span><span class="step-content"><span class="step-text">${step.text}</span>${changesHtml}</span></li>`;
  }
  
  /**
   * Create a thinking container element
   */
  function createThinkingContainer(steps, isCollapsed = false) {
    const container = document.createElement('div');
    container.className = 'thinking-container' + (isCollapsed ? ' visible' : '');
    
    const stepsHtml = steps.map(step => buildStepHtml(step, '')).join('');
    
    container.innerHTML = `
      <div class="thinking-header${isCollapsed ? ' done' : ''}">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">${steps.length} steps</span>
        </div>
        <div class="steps-toggle">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list">
        ${stepsHtml}
      </ul>
    `;
    
    const header = container.querySelector('.thinking-header');
    if (header) {
      header.style.cursor = 'pointer';
    }
    
    return container;
  }
  
  // ============================================
  // NEURAL NODE WORKFLOW
  // Full animation sequence with conversation support
  // ============================================
  
   async function runNeuralNodeWorkflow() {
     if (isAnimating) return;
     isAnimating = true;
    
    const startTime = Date.now();
    
    const els = getElements();
    const chatEl = els.chatMessages;
    const nodeEl = els.persistentNode;
    const gifEl = els.gifSection;
    
    if (!chatEl || !nodeEl) {
      isAnimating = false;
      return;
    }
    
    const conversation = conversations[activeConversation];
    if (!conversation) {
      console.warn('View6Chat: No conversation found for:', activeConversation);
      isAnimating = false;
      return;
    }
    
    const steps = conversation.thinkingSequence;
    const finalMsg = conversation.finalMessage;
    const thoughtTrailText = conversation.thoughtTrail || 'Analysing 3D model requirements and generating coordinated geometry.';
    
    // === STEP 1: Move node LEFT ===
    nodeEl.classList.add('left');
    await sleep(TIMING.nodeMove);
    
    // === STEP 2: PAUSE ===
    await sleep(TIMING.pause);
    
    // === STEP 3: Start PULSING ===
    nodeEl.classList.add('processing');
    await sleep(200);
    
    // === STEP 4: Create thinking container ===
    const thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container';
    
    const stepsHtml = steps.map(step => buildStepHtml(step)).join('');
    
    // Extract unique files from steps
    const filesMap = {};
    steps.forEach(step => {
      if (step.filename) {
        if (!filesMap[step.filename]) {
          filesMap[step.filename] = { filename: step.filename, totalChanges: 0 };
        }
        const changeNum = parseInt(step.changes?.replace(/[^0-9]/g, '') || '0');
        filesMap[step.filename].totalChanges += changeNum;
      }
    });
    const changedFiles = Object.values(filesMap);
    
    // Build files list HTML
    const getFileIcon = (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      const icons = {
        'rvt': { class: 'rvt', label: 'RVT' },
        'dwg': { class: 'dwg', label: 'DWG' },
        'pdf': { class: 'pdf', label: 'PDF' },
        'xlsx': { class: 'xlsx', label: 'XLS' },
        'docx': { class: 'docx', label: 'DOC' }
      };
      return icons[ext] || { class: 'default', label: '◇' };
    };
    
    const filesListHtml = changedFiles.map(file => {
      const icon = getFileIcon(file.filename);
      return `
        <div class="file-changed-item">
          <span class="file-lang-icon ${icon.class}">${icon.label}</span>
          <span class="file-name">${file.filename}</span>
          <span class="file-changes"><span class="added">+${file.totalChanges}</span></span>
        </div>
      `;
    }).join('');
    
    const fileCount = changedFiles.length;
    
    thinkingContainer.innerHTML = `
      <div class="thinking-header">
        <div class="thinking-header-left">
          <div class="pulsing-node"></div>
          <span class="steps-count">0 steps</span>
        </div>
        <div class="steps-toggle">
          <span class="chevron">⌃</span>
        </div>
      </div>
      <ul class="steps-list">
        ${stepsHtml}
      </ul>
      <div class="thought-status">
        <span class="thought-status-text">Thinking...</span>
      </div>
      <div class="thought-trail">
        <div class="thought-trail-header">
          <span class="thought-trail-label">Thought for <span class="thought-duration">0s</span></span>
          <span class="thought-trail-expand">▼</span>
        </div>
        <div class="thought-trail-content">
          <p>${thoughtTrailText}</p>
        </div>
      </div>
    `;
    
    // Store files data for later use
    thinkingContainer.dataset.filesHtml = `
      <div class="files-changed-section visible">
        <div class="files-changed-header">
          <span class="files-changed-count">˅ ${fileCount} File${fileCount !== 1 ? 's' : ''}</span>
          <div class="files-changed-actions">
            <button class="files-action-btn undo-all">Undo all</button>
            <button class="files-action-btn keep-all">Keep All</button>
            <button class="files-action-btn review primary">Review</button>
          </div>
        </div>
        <div class="files-changed-list">
          ${filesListHtml}
        </div>
      </div>
    `;
    
    chatEl.appendChild(thinkingContainer);
    
    // Make visible
    await sleep(50);
    thinkingContainer.classList.add('visible');
    await sleep(400);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Get elements
    const header = thinkingContainer.querySelector('.thinking-header');
    const toggle = thinkingContainer.querySelector('.steps-toggle');
    const stepsList = thinkingContainer.querySelector('.steps-list');
    const stepEls = stepsList.querySelectorAll('li');
    const stepsCount = thinkingContainer.querySelector('.steps-count');
    
    // Expand
    toggle.classList.add('expanded');
    stepsList.classList.add('expanded');
    await sleep(200);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // === STEP 5: Reveal steps ONE BY ONE ===
    const thoughtStatusText = thinkingContainer.querySelector('.thought-status-text');
    
    for (let i = 0; i < stepEls.length; i++) {
      const currentStep = steps[i];
      if (thoughtStatusText) {
        thoughtStatusText.textContent = getStatusForStep(currentStep);
      }
      
      stepEls[i].classList.add('visible');
      stepEls[i].classList.remove('preview-hidden');
      
      if (i >= 2) {
        const hideIndex = i - 2;
        if (hideIndex > 0) {
          stepEls[hideIndex].classList.add('preview-hidden');
        }
      }
      
      stepsCount.textContent = `${i + 1} steps`;
      chatEl.scrollTop = chatEl.scrollHeight;
      await sleep(TIMING.stepReveal);
    }
    
    // === STEP 6: Complete ===
    const thinkDuration = Date.now() - startTime;
    header.classList.add('done');
    stepsCount.textContent = `${steps.length} steps`;
    
    thinkingContainer.classList.add('complete');
    const durationEl = thinkingContainer.querySelector('.thought-duration');
    if (durationEl) {
      durationEl.textContent = formatDuration(thinkDuration);
    }
    
    await sleep(500);
    
    // === STEP 7: Collapse ===
    toggle.classList.remove('expanded');
    stepsList.classList.remove('expanded');
    await sleep(TIMING.collapse);
    
    // === STEP 8: Add bot message ===
    const botMsg = document.createElement('div');
    botMsg.className = 'demo-msg-bot';
    botMsg.style.opacity = '0';
    botMsg.style.transform = 'translateY(10px)';
    botMsg.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    botMsg.innerHTML = '<p>' + finalMsg + '</p>';
    chatEl.appendChild(botMsg);
    chatEl.scrollTop = chatEl.scrollHeight;
    
    await sleep(50);
    botMsg.style.opacity = '1';
    botMsg.style.transform = 'translateY(0)';
    
    // === STEP 9b: Add files changed section ===
    if (thinkingContainer.dataset.filesHtml) {
      const filesWrapper = document.createElement('div');
      filesWrapper.innerHTML = thinkingContainer.dataset.filesHtml.replace('class="files-changed-section visible"', 'class="files-changed-section"');
      const filesSection = filesWrapper.firstElementChild;
      chatEl.appendChild(filesSection);
      
      await sleep(100);
      filesSection.classList.add('visible');
      
      await sleep(100);
      chatEl.scrollTop = chatEl.scrollHeight;
      
      const undoAllBtn = filesSection.querySelector('.files-action-btn.undo-all');
      const keepAllBtn = filesSection.querySelector('.files-action-btn.keep-all');
      const filesActions = filesSection.querySelector('.files-changed-actions');
      
      if (undoAllBtn) {
        undoAllBtn.addEventListener('click', () => {
          const gifSection = document.getElementById('gifSectionIndex6');
          if (gifSection) {
            const video = gifSection.querySelector('video');
            const poster = gifSection.querySelector('.video-poster');
            if (video) {
              video.pause();
              video.currentTime = 0;
              video.classList.remove('ready');
            }
            if (poster) {
              poster.classList.remove('hidden');
            }
            const revitBox = gifSection.closest('.demo-revit-box');
            if (revitBox && revitBox.classList.contains('expanded')) {
              const minBtn = revitBox.querySelector('.demo-titlebar-btn.min');
              if (minBtn) minBtn.click();
            }
          }
          if (filesActions) filesActions.style.display = 'none';
        });
      }
      
      if (keepAllBtn) {
        keepAllBtn.addEventListener('click', () => {
          if (filesActions) filesActions.style.display = 'none';
        });
      }
    }
    
    // === STEP 9: Maximize window and play video ===
    if (gifEl) {
      const revitBox = gifEl.closest('.demo-revit-box');
      if (revitBox) {
        const maxBtn = revitBox.querySelector('.demo-titlebar-btn.max');
        if (maxBtn && !revitBox.classList.contains('expanded')) {
          maxBtn.click();
        }
      }
      
      await sleep(500);
      
      const video = gifEl.querySelector('video');
      const img = gifEl.querySelector('img');
      const poster = gifEl.querySelector('.video-poster');
      
      if (video) {
        video.addEventListener('contextmenu', e => e.preventDefault());
        
        const conversationVideoSrc = conversation.videoSource;
        
        if (conversationVideoSrc) {
          try {
            const response = await fetch(conversationVideoSrc);
            const blob = await response.blob();
            video.src = URL.createObjectURL(blob);
          } catch (e) {
            video.src = conversationVideoSrc;
            video.load();
          }
        } else {
          const defaultSource = video.querySelector('source');
          if (defaultSource) {
            video.src = defaultSource.src;
          }
          video.load();
        }
        
        await sleep(300);
        
        if (poster) poster.classList.add('hidden');
        video.classList.add('ready');
        video.play();
        video.loop = false;
        
      } else if (img) {
        const gifSrc = img.src;
        img.src = '';
        img.src = gifSrc;
        await sleep(50);
        img.classList.add('playing');
      }
    }
    
    header.style.cursor = 'pointer';
    
    await sleep(TIMING.pause);
    
    // === STEP 11: Move node RIGHT ===
    nodeEl.classList.remove('left');
    await sleep(TIMING.nodeMove);
    
    // === STEP 12: Stop pulsing ===
    await sleep(TIMING.pause);
    nodeEl.classList.remove('processing');
    
    const els2 = getElements();
    if (els2.chatMessages) {
      initThinkingContainerHandlers(els2.chatMessages);
    }
    isAnimating = false;
  }
  
  // ============================================
  // CONVERSATION LOADING
  // ============================================
  
  function loadConversation(conversationKey) {
    const els = getElements();
    const chatEl = els.chatMessages;
    
    if (!chatEl) {
      console.warn('View6Chat: chatMessagesIndex6 not found');
      return;
    }
    
    const conversation = conversations[conversationKey];
    if (!conversation) {
      console.warn('View6Chat: conversation not found for:', conversationKey);
      return;
    }
    
    if (activeConversation && !conversationStates[activeConversation]?.completed) {
      conversationStates[activeConversation] = {
        completed: false,
        chatHTML: chatEl.innerHTML
      };
    }
    
    activeConversation = conversationKey;
    
    const savedState = conversationStates[conversationKey];
    if (savedState && savedState.chatHTML) {
      chatEl.innerHTML = savedState.chatHTML;
      chatEl.scrollTop = chatEl.scrollHeight;
      initThinkingContainerHandlers(chatEl);
      return;
    }
    
    chatEl.innerHTML = '';
    
    conversation.messages.forEach(msg => {
      if (msg.type === 'thinking') {
        const container = createThinkingContainer(msg.steps, true);
        chatEl.appendChild(container);
      } else {
        const msgDiv = document.createElement('div');
        msgDiv.className = msg.type === 'user' ? 'demo-msg-user' : 'demo-msg-bot';
        msgDiv.innerHTML = '<p>' + msg.text + '</p>';
        chatEl.appendChild(msgDiv);
      }
    });
    
    initThinkingContainerHandlers(chatEl);
    
    const promptDiv = document.createElement('div');
    promptDiv.className = 'demo-ready-prompt';
    promptDiv.innerHTML = '<span>' + conversation.readyPrompt + '</span>';
    chatEl.appendChild(promptDiv);
    
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  
  // ============================================
  // CHAT INPUT HANDLING
  // ============================================
  
  function addMessageWithAnimation(chatEl, className, html) {
    const msg = document.createElement('div');
    msg.className = className;
    msg.style.opacity = '0';
    msg.style.transform = 'translateY(12px) scale(0.98)';
    msg.innerHTML = html;
    chatEl.appendChild(msg);
    
    // Force reflow to ensure initial state is painted before transition
    msg.offsetHeight;
    
    // Now add transition and animate
    msg.style.transition = 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        msg.style.opacity = '1';
        msg.style.transform = 'translateY(0) scale(1)';
    
    return msg;
  }
  
   async function handleChatSend(e) {
     
     if (e) {
       e.stopImmediatePropagation();
       e.preventDefault();
     }
     
     const inputEl = document.getElementById('chatInputIndex6');
     const inputVal = (inputEl?.value || inputEl?.textContent || '').trim();

     if (!inputVal) {
       return;
     }

     // Prevent rapid double-clicks (500ms debounce)
     const now = Date.now();
     if ((now - lastSendTime) < SEND_DEBOUNCE_MS) {
       return;
     }
     lastSendTime = now;
     
     // Clear input IMMEDIATELY so user knows action was taken
     if (inputEl.value !== undefined) {
       inputEl.value = '';
     } else {
       inputEl.textContent = '';
     }
     
     // Initialize visual queue view if needed
     initMessageQueueView();
     
      // Add to visual queue for "waiting" indicator
      // Message will appear in chat when C# onBeforeProcess fires (when queue processes it)
      if (messageQueueView) {
     messageQueueView.addMessage(inputVal);
      }
     
     // ALWAYS send to Revit immediately. Revit's ChatMessageQueue handles the actual 
     // sequential processing. The local isSending flags in JS are now mostly for 
     // blocking rapid double-clicks on the Send button itself.
     if (isWebView2) {
       if (currentSessionId && chatSessions[currentSessionId] && chatSessions[currentSessionId].title === 'New Chat') {
         updateSessionTitle(currentSessionId, inputVal);
       }
       const sendResult = sendToRevit('chat', inputVal);
     } else {
     }
     
     isSending = true;
     window.isSending = true;
   }
   
  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    
    // Initialize Revit bridge if in WebView2
    setupRevitBridge();
    
    // History item clicks - session switching
    document.addEventListener('click', function(e) {
      const historyItem = e.target.closest('#chatHistoryIndex6 .demo-history-item');
      if (!historyItem) return;
      
      const sessionId = historyItem.getAttribute('data-session-id');
      if (sessionId && chatSessions[sessionId]) {
        
        loadSession(sessionId);
      }
    });
    
    // Send button click
    document.addEventListener('click', function(e) {
      if (e.target.closest('#chatSendIndex6')) {
        handleChatSend(e);
      }
    });
    
    // New Agent button - starts fresh conversation
    document.addEventListener('click', function(e) {
      if (e.target.closest('.new-agent-btn')) {
        e.preventDefault();
        startNewChat();
      }
    });
    
    // Enter key in input
    document.addEventListener('keydown', function(e) {
      const inputEl = document.getElementById('chatInputIndex6');
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputEl) {
        e.preventDefault();
        handleChatSend(e);
      }
    });
    
    initThinkingContainerHandlers(document.getElementById('chatMessagesIndex6'));
  }
  
  let thinkingDelegationInitialized = false;
  
  function initThinkingContainerHandlers(parentEl) {
    if (!parentEl) return;
    
    parentEl.querySelectorAll('.thinking-container .thinking-header').forEach(header => {
      header.style.cursor = 'pointer';
    });
    
    if (!thinkingDelegationInitialized) {
      thinkingDelegationInitialized = true;
      
      document.addEventListener('click', function(e) {
        if (!e.target.closest('#chatMessagesIndex6')) return;
        
        const header = e.target.closest('.thinking-header');
        if (!header) return;
        
        const container = header.closest('.thinking-container');
        if (!container) return;
        
        const toggle = container.querySelector('.steps-toggle');
        const stepsList = container.querySelector('.steps-list');
        
        if (stepsList) {
          const isExpanded = stepsList.classList.contains('expanded');
          
          if (toggle) toggle.classList.toggle('expanded');
          stepsList.classList.toggle('expanded');
          
          if (isExpanded) {
            stepsList.classList.remove('fully-expanded');
          } else {
            stepsList.classList.add('fully-expanded');
            stepsList.querySelectorAll('li').forEach(li => li.classList.add('visible'));
          }
        }
      });
      
      document.addEventListener('click', function(e) {
        if (!e.target.closest('#chatMessagesIndex6')) return;
        
        const thoughtHeader = e.target.closest('.thought-trail-header');
        if (!thoughtHeader) return;
        
        const thoughtTrail = thoughtHeader.closest('.thought-trail');
        if (thoughtTrail) {
          thoughtTrail.classList.toggle('expanded');
        }
      });
    }
  }
  
  // Chat sidebar resize handle for View 6
  function initResizeHandler() {
    const chatSidebarResize = document.querySelector('#modellingOverlay .chat-sidebar-resize');
    if (chatSidebarResize) {
      let isResizingChat = false;
      let startX = 0;
      let startSidebarWidth = 0;
      
      chatSidebarResize.addEventListener('mousedown', (e) => {
        isResizingChat = true;
        startX = e.clientX;
        const sidebar = chatSidebarResize.previousElementSibling;
        if (sidebar) {
          startSidebarWidth = sidebar.offsetWidth;
        }
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isResizingChat) return;
        const sidebar = chatSidebarResize.previousElementSibling;
        if (sidebar) {
          const deltaX = e.clientX - startX;
          const newWidth = Math.max(120, Math.min(400, startSidebarWidth + deltaX));
          sidebar.style.width = newWidth + 'px';
          sidebar.style.flex = 'none';
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (isResizingChat) {
          isResizingChat = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initResizeHandler(); });
  } else {
    init();
    initResizeHandler();
  }
  
  // Expose for external access if needed
  window.View6Chat = {
    loadConversation: loadConversation,
    getActiveConversation: function() { return activeConversation; },
    conversations: conversations
  };
  
  // Expose helper functions globally for C# injected scripts
  window.addMessageWithAnimation = addMessageWithAnimation;
  window.escapeHtml = escapeHtml;
  
})();

