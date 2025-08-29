// 初始化 Supabase
const supabaseUrl = 'https://[你的项目引用].supabase.co'; // 请替换为你的 Supabase 项目 URL
const supabaseKey = '[你的项目密钥]'; // 请替换为你的 Supabase 项目密钥
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// 辅助函数
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

// ===================================
// 主页 (index.html) 功能
// ===================================
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    const sentenceCard = document.getElementById('sentence-card');
    const spanishText = sentenceCard.querySelector('.spanish');
    const chineseText = sentenceCard.querySelector('.chinese');
    const notesTextarea = document.getElementById('notes');
    const emptyMessage = document.getElementById('empty-message');
    const prevBtn = document.getElementById('prev-sentence-btn');
    const nextBtn = document.getElementById('next-sentence-btn');
    const readBtn = document.getElementById('index-read-btn');
    const slowReadBtn = document.getElementById('index-slow-read-btn');
    const wordReadBtn = document.getElementById('index-word-read-btn');
    const aiExplainBtn = document.getElementById('index-ai-explain-btn');
    const masteredBtn = document.getElementById('index-mastered-btn');

    const aiExplanationModal = document.getElementById('aiExplanationModal');
    const aiExplanationTitle = document.getElementById('aiExplanationTitle');
    const aiExplanationContent = document.getElementById('aiExplanationContent');
    const aiExplanationCloseBtn = document.getElementById('aiExplanationCloseBtn');

    // 新增筛选相关元素
    const filterIconBtn = document.getElementById('filter-icon-btn');
    const filterPanel = document.getElementById('filter-panel');
    const statusFilter = document.getElementById('status-filter');
    const sortOrder = document.getElementById('sort-order');

    let allSentences = [];
    let currentSentenceIndex = 0;
    let filteredSentences = [];

    const fetchSentences = async () => {
        let { data: sentences, error } = await supabase
            .from('sentences')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching sentences:', error);
            emptyMessage.textContent = '加载句子失败。';
            return;
        }

        allSentences = sentences;
        if (allSentences.length > 0) {
            emptyMessage.style.display = 'none';
        } else {
            emptyMessage.style.display = 'block';
            emptyMessage.textContent = '当前没有句子。请前往管理页面添加。';
        }
        applyFiltersAndSort();
    };

    const applyFiltersAndSort = () => {
        const status = statusFilter.value;
        const order = sortOrder.value;

        filteredSentences = allSentences.filter(s => {
            if (status === 'all') return true;
            return status === 'mastered' ? s.is_mastered : !s.is_mastered;
        });

        if (order === 'random') {
            filteredSentences.sort(() => Math.random() - 0.5);
        } else {
            filteredSentences.sort((a, b) => a.id - b.id);
        }

        currentSentenceIndex = 0;
        displayCurrentSentence();
    };

    const displayCurrentSentence = () => {
        if (filteredSentences.length === 0) {
            spanishText.textContent = '没有符合条件的句子';
            chineseText.textContent = '';
            notesTextarea.value = '';
            sentenceCard.style.display = 'none';
            emptyMessage.style.display = 'block';
            emptyMessage.textContent = '没有符合筛选条件的句子。';
            return;
        }

        emptyMessage.style.display = 'none';
        sentenceCard.style.display = 'flex';

        const sentence = filteredSentences[currentSentenceIndex];
        spanishText.textContent = sentence.spanish;
        chineseText.textContent = sentence.chinese;
        notesTextarea.value = sentence.notes || '';
    };

    const saveNotes = debounce(async () => {
        if (filteredSentences.length === 0) return;
        const sentence = filteredSentences[currentSentenceIndex];
        await supabase
            .from('sentences')
            .update({ notes: notesTextarea.value })
            .eq('id', sentence.id);
    }, 1000);

    const speakText = (text, rate) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = rate;
            window.speechSynthesis.speak(utterance);
        } else {
            alert('抱歉，您的浏览器不支持语音朗读功能。');
        }
    };

    const speakWordByWord = (text, rate) => {
        const words = text.split(/\s+/);
        let i = 0;

        function speakNextWord() {
            if (i < words.length) {
                const utterance = new SpeechSynthesisUtterance(words[i]);
                utterance.lang = 'es-ES';
                utterance.rate = rate;
                utterance.onend = speakNextWord;
                window.speechSynthesis.speak(utterance);
                i++;
            }
        }
        speakNextWord();
    };

    const getAIExplanation = async (text) => {
        const explanation = await window.prompt(`请为以下西班牙语句子提供 AI 解释：\n\n"${text}"\n\n（这是一个模拟，请直接输入你的解释内容）`);
        return explanation;
    };

    // 事件监听器
    notesTextarea.addEventListener('input', saveNotes);

    // 新增：筛选图标点击事件
    if (filterIconBtn) {
        filterIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterPanel.classList.toggle('show');
        });

        // 点击页面其他地方关闭面板
        document.addEventListener('click', (e) => {
            if (filterPanel.classList.contains('show') && !filterPanel.contains(e.target) && !filterIconBtn.contains(e.target)) {
                filterPanel.classList.remove('show');
            }
        });
    }

    statusFilter.addEventListener('change', applyFiltersAndSort);
    sortOrder.addEventListener('change', applyFiltersAndSort);

    prevBtn.addEventListener('click', () => {
        currentSentenceIndex = (currentSentenceIndex - 1 + filteredSentences.length) % filteredSentences.length;
        displayCurrentSentence();
    });

    nextBtn.addEventListener('click', () => {
        currentSentenceIndex = (currentSentenceIndex + 1) % filteredSentences.length;
        displayCurrentSentence();
    });

    readBtn.addEventListener('click', () => {
        if (filteredSentences.length > 0) {
            speakText(filteredSentences[currentSentenceIndex].spanish, 1.0);
        }
    });

    slowReadBtn.addEventListener('click', () => {
        if (filteredSentences.length > 0) {
            speakText(filteredSentences[currentSentenceIndex].spanish, 0.5);
        }
    });

    wordReadBtn.addEventListener('click', () => {
        if (filteredSentences.length > 0) {
            speakWordByWord(filteredSentences[currentSentenceIndex].spanish, 1.0);
        }
    });

    masteredBtn.addEventListener('click', async () => {
        if (filteredSentences.length > 0) {
            const sentence = filteredSentences[currentSentenceIndex];
            const newMasteryStatus = !sentence.is_mastered;
            const { error } = await supabase
                .from('sentences')
                .update({ is_mastered: newMasteryStatus })
                .eq('id', sentence.id);
            if (!error) {
                sentence.is_mastered = newMasteryStatus;
                masteredBtn.classList.toggle('mastered', newMasteryStatus);
                alert(`已将句子标记为“${newMasteryStatus ? '已掌握' : '未掌握'}”`);
            }
        }
    });

    aiExplainBtn.addEventListener('click', async () => {
        if (filteredSentences.length === 0) return;
        const sentence = filteredSentences[currentSentenceIndex];
        const title = `AI 解释：${sentence.spanish}`;
        
        aiExplanationTitle.textContent = title;
        aiExplanationContent.innerHTML = `<div class="loading-spinner"></div><p style="text-align:center;">正在加载解释...</p>`;
        aiExplanationModal.style.display = 'flex';

        if (sentence.ai_notes) {
            aiExplanationContent.textContent = sentence.ai_notes;
        } else {
            const explanation = await getAIExplanation(sentence.spanish);
            if (explanation) {
                const { error } = await supabase
                    .from('sentences')
                    .update({ ai_notes: explanation })
                    .eq('id', sentence.id);
                
                if (error) {
                    console.error('Error saving AI explanation:', error);
                    aiExplanationContent.textContent = `保存解释时出错: ${error.message}`;
                } else {
                    sentence.ai_notes = explanation;
                    aiExplanationContent.textContent = explanation;
                }
            } else {
                aiExplanationContent.textContent = '解释生成失败或被取消。';
            }
        }
    });

    aiExplanationCloseBtn.addEventListener('click', () => {
        aiExplanationModal.style.display = 'none';
    });
    
    fetchSentences();
}

// ===================================
// 词汇页 (vocabulary.html) 功能
// ===================================
else if (window.location.pathname.includes('vocabulary.html')) {
    const wordCard = document.getElementById('word-card');
    const wordSpanish = wordCard.querySelector('.spanish-word');
    const wordChinese = wordCard.querySelector('.chinese-translation');
    const sourceSentenceP = document.getElementById('word-source-sentence');
    const emptyMessage = document.getElementById('empty-vocabulary-message');
    const prevBtn = document.getElementById('prev-word-btn');
    const nextBtn = document.getElementById('next-word-btn');
    const readBtn = document.getElementById('word-read-btn');
    const slowReadBtn = document.getElementById('word-slow-read-btn');
    const masteredBtn = document.getElementById('word-mastered-btn');

    // 新增筛选相关元素
    const filterIconBtn = document.getElementById('filter-icon-btn');
    const filterPanel = document.getElementById('filter-panel');
    const statusFilter = document.getElementById('word-status-filter');
    const sortOrder = document.getElementById('word-sort-order');

    let allWords = [];
    let currentWordIndex = 0;
    let filteredWords = [];

    const fetchWords = async () => {
        let { data: words, error } = await supabase
            .from('vocabulary')
            .select(`
                id,
                word,
                translation,
                is_mastered,
                source_sentence_id
            `)
            .order('frequency_rank', { ascending: true });

        if (error) {
            console.error('Error fetching words:', error);
            emptyMessage.textContent = '加载词汇失败。';
            return;
        }

        allWords = words;
        if (allWords.length > 0) {
            emptyMessage.style.display = 'none';
        } else {
            emptyMessage.style.display = 'block';
            emptyMessage.textContent = '当前没有高频词汇。';
        }
        applyFiltersAndSort();
    };

    const applyFiltersAndSort = () => {
        const status = statusFilter.value;
        const order = sortOrder.value;

        filteredWords = allWords.filter(w => {
            if (status === 'all') return true;
            return status === 'mastered' ? w.is_mastered : !w.is_mastered;
        });

        if (order === 'random') {
            filteredWords.sort(() => Math.random() - 0.5);
        } else {
            filteredWords.sort((a, b) => a.frequency_rank - b.frequency_rank);
        }

        currentWordIndex = 0;
        displayCurrentWord();
    };

    const displayCurrentWord = async () => {
        if (filteredWords.length === 0) {
            wordSpanish.textContent = '没有符合条件的词汇';
            wordChinese.textContent = '';
            sourceSentenceP.textContent = '';
            wordCard.style.display = 'none';
            emptyMessage.style.display = 'block';
            emptyMessage.textContent = '没有符合筛选条件的词汇。';
            return;
        }

        emptyMessage.style.display = 'none';
        wordCard.style.display = 'flex';

        const word = filteredWords[currentWordIndex];
        wordSpanish.textContent = word.word;
        wordChinese.textContent = word.translation;
        
        if (word.source_sentence_id) {
            const { data: sentence, error } = await supabase
                .from('sentences')
                .select('spanish')
                .eq('id', word.source_sentence_id)
                .single();
            if (sentence) {
                sourceSentenceP.textContent = `来源句: ${sentence.spanish}`;
            } else {
                sourceSentenceP.textContent = '来源句未找到。';
            }
        } else {
            sourceSentenceP.textContent = '无来源句。';
        }
    };

    const speakText = (text, rate) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = rate;
            window.speechSynthesis.speak(utterance);
        } else {
            alert('抱歉，您的浏览器不支持语音朗读功能。');
        }
    };

    // 事件监听器
    if (filterIconBtn) {
        filterIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterPanel.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (filterPanel.classList.contains('show') && !filterPanel.contains(e.target) && !filterIconBtn.contains(e.target)) {
                filterPanel.classList.remove('show');
            }
        });
    }

    statusFilter.addEventListener('change', applyFiltersAndSort);
    sortOrder.addEventListener('change', applyFiltersAndSort);

    prevBtn.addEventListener('click', () => {
        currentWordIndex = (currentWordIndex - 1 + filteredWords.length) % filteredWords.length;
        displayCurrentWord();
    });

    nextBtn.addEventListener('click', () => {
        currentWordIndex = (currentWordIndex + 1) % filteredWords.length;
        displayCurrentWord();
    });

    readBtn.addEventListener('click', () => {
        if (filteredWords.length > 0) {
            speakText(filteredWords[currentWordIndex].word, 1.0);
        }
    });

    slowReadBtn.addEventListener('click', () => {
        if (filteredWords.length > 0) {
            speakText(filteredWords[currentWordIndex].word, 0.5);
        }
    });

    masteredBtn.addEventListener('click', async () => {
        if (filteredWords.length > 0) {
            const word = filteredWords[currentWordIndex];
            const newMasteryStatus = !word.is_mastered;
            const { error } = await supabase
                .from('vocabulary')
                .update({ is_mastered: newMasteryStatus })
                .eq('id', word.id);
            if (!error) {
                word.is_mastered = newMasteryStatus;
                masteredBtn.classList.toggle('mastered', newMasteryStatus);
                alert(`已将词汇标记为“${newMasteryStatus ? '已掌握' : '未掌握'}”`);
            }
        }
    });
    
    fetchWords();
}

// ===================================
// 管理页 (manage.html) 功能
// ===================================
else if (window.location.pathname.includes('manage.html')) {
    const batchInput = document.getElementById('batch-input');
    const addBatchBtn = document.getElementById('add-batch-button');
    const sentenceList = document.getElementById('sentence-list');
    const sentenceSearch = document.getElementById('sentence-search');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    let allSentences = [];
    let isEditing = {};

    const fetchSentences = async () => {
        const { data, error } = await supabase
            .from('sentences')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching sentences:', error);
            return;
        }
        allSentences = data;
        renderSentenceList(allSentences);
    };

    const renderSentenceList = (sentences) => {
        sentenceList.innerHTML = '';
        if (sentences.length === 0) {
            sentenceList.innerHTML = '<li class="empty-list-message">没有找到句子。</li>';
            return;
        }
        sentences.forEach(s => {
            const li = document.createElement('li');
            li.className = 'sentence-item';
            li.setAttribute('data-id', s.id);
            li.innerHTML = `
                <input type="checkbox" class="sentence-checkbox">
                <div class="sentence-text">
                    <span class="spanish">${s.spanish}</span>
                    <span class="chinese">${s.chinese}</span>
                </div>
                <div class="sentence-actions">
                    <button class="action-btn edit-btn" title="编辑">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="action-btn save-btn" title="保存">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-save"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    </button>
                    <button class="action-btn cancel-btn" title="取消">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x-circle"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="15" x2="15" y2="9"></line></svg>
                    </button>
                    <button class="action-btn delete-btn" title="删除">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            `;
            sentenceList.appendChild(li);
        });
    };

    const addBatch = async () => {
        const sentences = batchInput.value.split('\n').filter(s => s.trim() !== '');
        if (sentences.length === 0) {
            alert('请输入句子。');
            return;
        }

        const dataToInsert = sentences.map(s => ({ spanish: s.trim() }));
        const { error } = await supabase
            .from('sentences')
            .insert(dataToInsert);

        if (error) {
            alert('添加句子失败：' + error.message);
        } else {
            alert('句子已成功添加！');
            batchInput.value = '';
            fetchSentences();
        }
    };

    const confirmAction = (message) => {
        return new Promise(resolve => {
            confirmMessage.textContent = message;
            confirmModal.style.display = 'flex';
            confirmBtn.onclick = () => {
                confirmModal.style.display = 'none';
                resolve(true);
            };
            cancelBtn.onclick = () => {
                confirmModal.style.display = 'none';
                resolve(false);
            };
        });
    };

    const deleteSentence = async (id) => {
        const confirmed = await confirmAction('确定要删除此句子吗？');
        if (confirmed) {
            const { error } = await supabase
                .from('sentences')
                .delete()
                .eq('id', id);
            if (error) {
                alert('删除失败：' + error.message);
            } else {
                fetchSentences();
            }
        }
    };

    const deleteSelected = async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.sentence-checkbox:checked'));
        if (checkedBoxes.length === 0) {
            alert('请选择要删除的句子。');
            return;
        }

        const confirmed = await confirmAction(`确定要删除选中的 ${checkedBoxes.length} 个句子吗？`);
        if (confirmed) {
            const idsToDelete = checkedBoxes.map(cb => cb.closest('.sentence-item').getAttribute('data-id'));
            const { error } = await supabase
                .from('sentences')
                .delete()
                .in('id', idsToDelete);
            if (error) {
                alert('批量删除失败：' + error.message);
            } else {
                fetchSentences();
                selectAllCheckbox.checked = false;
            }
        }
    };
    
    const saveSentence = async (id, spanish, chinese) => {
        const { error } = await supabase
            .from('sentences')
            .update({ spanish: spanish, chinese: chinese, ai_notes: null })
            .eq('id', id);
        if (error) {
            alert('更新句子失败：' + error.message);
        } else {
            const index = allSentences.findIndex(s => s.id == id);
            if (index !== -1) {
                allSentences[index].spanish = spanish;
                allSentences[index].chinese = chinese;
                allSentences[index].ai_notes = null;
            }
            fetchSentences();
        }
    };

    const startEdit = (li) => {
        const id = li.getAttribute('data-id');
        const sentence = allSentences.find(s => s.id == id);
        
        li.classList.add('edit-mode');
        const spanishSpan = li.querySelector('.spanish');
        const chineseSpan = li.querySelector('.chinese');
        
        const spanishInput = document.createElement('input');
        spanishInput.type = 'text';
        spanishInput.value = spanishSpan.textContent;
        spanishSpan.replaceWith(spanishInput);

        const chineseInput = document.createElement('input');
        chineseInput.type = 'text';
        chineseInput.value = chineseSpan.textContent;
        chineseSpan.replaceWith(chineseInput);

        isEditing[id] = true;
    };

    const cancelEdit = (li) => {
        const id = li.getAttribute('data-id');
        const sentence = allSentences.find(s => s.id == id);
        
        li.classList.remove('edit-mode');
        const spanishInput = li.querySelector('input[type="text"]');
        const chineseInput = li.querySelector('input[type="text"]:nth-of-type(2)');
        
        const spanishSpan = document.createElement('span');
        spanishSpan.className = 'spanish';
        spanishSpan.textContent = sentence.spanish;
        spanishInput.replaceWith(spanishSpan);

        const chineseSpan = document.createElement('span');
        chineseSpan.className = 'chinese';
        chineseSpan.textContent = sentence.chinese;
        chineseInput.replaceWith(chineseSpan);

        isEditing[id] = false;
    };

    // 事件监听器
    addBatchBtn.addEventListener('click', addBatch);
    deleteSelectedBtn.addEventListener('click', deleteSelected);

    sentenceSearch.addEventListener('input', debounce(() => {
        const query = sentenceSearch.value.toLowerCase();
        const filtered = allSentences.filter(s => 
            s.spanish.toLowerCase().includes(query) || 
            s.chinese.toLowerCase().includes(query)
        );
        renderSentenceList(filtered);
    }, 300));

    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.sentence-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    sentenceList.addEventListener('click', (e) => {
        const target = e.target;
        const li = target.closest('.sentence-item');
        if (!li) return;
        
        const id = li.getAttribute('data-id');

        if (target.closest('.edit-btn')) {
            startEdit(li);
        } else if (target.closest('.save-btn')) {
            const spanish = li.querySelector('.sentence-text input:first-of-type').value;
            const chinese = li.querySelector('.sentence-text input:last-of-type').value;
            saveSentence(id, spanish, chinese);
        } else if (target.closest('.cancel-btn')) {
            cancelEdit(li);
        } else if (target.closest('.delete-btn')) {
            deleteSentence(id);
        }
    });

    fetchSentences();
}