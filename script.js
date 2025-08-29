// === 1. Configure Supabase client ===
const SUPABASE_URL = 'https://rvarfascuwvponxwdeoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2YXJmYXNjdXd2cG9ueHdkZW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNDE5MDcsImV4cCI6MjA3MTgxNzkwN30.KdBVtNYdOw9n8351FWlAgAPCv0WmSnr9vOGgtHCRSnc';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === 2. Getting DOM elements ===
const isIndexPage = document.getElementById('sentence-card-container') !== null;
const isManagePage = document.body.classList.contains('manage-page');
const isVocabularyPage = document.getElementById('word-card-container') !== null;

// Index Page elements
const statusFilter = document.getElementById('status-filter');
const sortOrder = document.getElementById('sort-order');
const sentenceCardContainer = document.getElementById('sentence-card-container');
const sentenceCard = document.getElementById('sentence-card');
const notesTextarea = document.getElementById('notes');
const emptyMessage = document.getElementById('empty-message');
const indexSpanishText = sentenceCard?.querySelector('.spanish');
const indexChineseText = sentenceCard?.querySelector('.chinese');
const indexReadBtn = sentenceCard?.querySelector('#index-read-btn');
const indexSlowReadBtn = sentenceCard?.querySelector('#index-slow-read-btn');
const indexWordReadBtn = sentenceCard?.querySelector('#index-word-read-btn');
const indexAiExplainBtn = sentenceCard?.querySelector('#index-ai-explain-btn');
const indexMasteredBtn = sentenceCard?.querySelector('#index-mastered-btn');
const prevSentenceBtn = document.getElementById('prev-sentence-btn');
const nextSentenceBtn = document.getElementById('next-sentence-btn');

// Manage Page elements
const batchInput = document.getElementById('batch-input');
const addBatchBtn = document.getElementById('add-batch-button');
const sentenceList = document.getElementById('sentence-list');
const sentencesHeader = document.getElementById('sentences-header');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const sentenceSearch = document.getElementById('sentence-search');
let allSentences = []; // Re-declare to be global for search

// Vocabulary Page elements
const wordCardContainer = document.getElementById('word-card-container');
const wordCard = document.getElementById('word-card');
const emptyVocabularyMessage = document.getElementById('empty-vocabulary-message');
const wordReadBtn = wordCard?.querySelector('#word-read-btn');
const wordSlowReadBtn = wordCard?.querySelector('#word-slow-read-btn');
const prevWordBtn = document.getElementById('prev-word-btn');
const nextWordBtn = document.getElementById('next-word-btn');
const spanishWord = wordCard?.querySelector('.spanish-word');
const chineseTranslation = wordCard?.querySelector('.chinese-translation');
const wordSourceSentence = document.getElementById('word-source-sentence');
const wordStatusFilter = document.getElementById('word-status-filter');
const wordSortOrder = document.getElementById('word-sort-order');
let allWords = []; // A new global variable for all words

// Modals
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const aiExplanationModal = document.getElementById('aiExplanationModal');
const aiExplanationTitle = document.getElementById('aiExplanationTitle');
const aiExplanationContent = document.getElementById('aiExplanationContent');
const aiExplanationCloseBtn = document.getElementById('aiExplanationCloseBtn');

const audio = new Audio();
let currentFilteredSentences = [];
let currentIndex = 0;
let currentFilteredWords = [];
let currentWordIndex = 0;

// === 3. Core Functions ===

function showCustomConfirm(message, showButtons = true) {
    return new Promise((resolve) => {
        if (!confirmModal) return resolve(false);
        confirmMessage.innerText = message;
        confirmModal.style.display = 'flex';
        confirmBtn.style.display = showButtons ? 'inline-block' : 'none';
        cancelBtn.style.display = showButtons ? 'inline-block' : 'none';

        const onConfirm = () => {
            confirmModal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(true);
        };

        const onCancel = () => {
            confirmModal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(false);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

function showAiExplanation(title, content) {
    if (!aiExplanationModal) return;
    aiExplanationTitle.innerText = title;
    aiExplanationContent.innerHTML = content;
    aiExplanationModal.style.display = 'flex';
}

if (aiExplanationCloseBtn) {
    aiExplanationCloseBtn.addEventListener('click', () => {
        aiExplanationModal.style.display = 'none';
    });
}

async function readTextWithSupabase(text, isSlow = false, button) {
    const TTS_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/tts`;
    const request = { text: text, isSlow: isSlow };
    
    // Remove playing class from all buttons
    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('playing'));
    if (button) button.classList.add('playing');

    return new Promise((resolve, reject) => {
        const handleEnd = () => {
            audio.removeEventListener('ended', handleEnd);
            if (button) button.classList.remove('playing');
            resolve();
        };

        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            if (button) button.classList.remove('playing');
            reject(e);
        });

        fetch(TTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        }).then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Supabase TTS API error: ${text}`);
                });
            }
            return response.json();
        }).then(data => {
            const audioContent = data.audioContent;
            audio.src = `data:audio/mp3;base64,${audioContent}`;
            audio.play();
        }).catch(error => {
            console.error('Failed to fetch from Supabase TTS:', error);
            if (button) button.classList.remove('playing');
            reject(error);
        });
    });
}

async function readWordByWord(sentence) {
    const words = sentence.split(/\s+/).filter(word => word.length > 0);
    const button = indexWordReadBtn;
    if (button) button.classList.add('playing');

    try {
        for (const word of words) {
            await readTextWithSupabase(word);
            await new Promise(resolve => setTimeout(resolve, 300)); // Pause between words
        }
    } finally {
        if (button) button.classList.remove('playing');
    }
}

async function getAiExplanation(spanishSentence) {
    const EXPLAIN_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence`;
    showAiExplanation('AI 正在生成解释', `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成解释中，请稍候...</p>`);

    try {
        const payload = { sentence: spanishSentence, getExplanation: true };
        const response = await fetch(EXPLAIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error('Supabase Explain API error:', errorDetails);
            showAiExplanation('错误', `<p>AI 解释生成失败。请检查控制台错误信息。</p>`);
            return;
        }
        const result = await response.json();
        const explanation = result.explanation || '未能获取 AI 解释。';
        showAiExplanation('AI 句子解释', `<p>${explanation.replace(/\n/g, '<br>')}</p>`);
    } catch (error) {
        console.error('Failed to fetch from Supabase Explain API:', error);
        showAiExplanation('错误', `<p>无法连接到 AI 服务。请检查您的网络连接或稍后再试。</p><p>错误详情: ${error.message}</p>`);
    }
}

// Helper function to get words from a sentence, excluding common stop words
const stopWords = new Set([
    'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 
    'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas', 
    'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha',
    'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les',
    'que', 'quien', 'cuyo', 'donde', 'como', 'cuando', 'cual', 'mi'
]);
function getWordsFromSentence(sentence) {
    const punctuationRegex = /[.,;!?()"\-—:]/g;
    return sentence.toLowerCase().replace(punctuationRegex, '').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
}

async function generateAndUpdateHighFrequencyWords() {
    console.log('开始重新生成和更新词汇表...');
    
    // 1. Fetch ALL sentences and ALL existing words with their translations
    const { data: allSentencesData, error: fetchAllError } = await _supabase
        .from('sentences')
        .select('spanish_text');
    if (fetchAllError) {
        console.error('获取所有句子失败，无法更新词汇表:', fetchAllError);
        return;
    }
    
    const { data: existingWordsInDb, error: fetchWordsError } = await _supabase
        .from('high_frequency_words')
        .select('spanish_word, chinese_translation');
    if (fetchWordsError) {
        console.error('获取现有词汇失败:', fetchWordsError);
        return;
    }
    const existingWordMap = new Map(existingWordsInDb.map(w => [w.spanish_word, w.chinese_translation]));

    // 2. Recalculate word counts and source sentences from the remaining sentences
    const wordCounts = {};
    const wordSourceSentences = {};
    const allWordsFromSentences = allSentencesData.flatMap(s => getWordsFromSentence(s.spanish_text));
    allWordsFromSentences.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        if (!wordSourceSentences[word]) {
            const foundSentence = allSentencesData.find(s => s.spanish_text.toLowerCase().includes(word));
            if (foundSentence) {
                wordSourceSentences[word] = foundSentence.spanish_text;
            }
        }
    });

    // 3. Find words to delete (in old list but not in new list)
    const newWordSet = new Set(Object.keys(wordCounts));
    const wordsToDelete = existingWordsInDb.map(w => w.spanish_word).filter(word => !newWordSet.has(word));
    if (wordsToDelete.length > 0) {
        const { error: deleteError } = await _supabase
            .from('high_frequency_words')
            .delete()
            .in('spanish_word', wordsToDelete);

        if (deleteError) {
            console.error('Failed to delete unused high frequency words:', deleteError);
        } else {
            console.log(`成功删除了 ${wordsToDelete.length} 个不再使用的词汇。`);
        }
    } else {
        console.log('没有发现需要删除的词汇。');
    }

    // 4. Find words to update/insert, and get translations for new words
    const wordsToUpsert = Object.keys(wordCounts).map(word => {
        return {
            spanish_word: word,
            frequency: wordCounts[word],
            source_sentence: wordSourceSentences[word],
            chinese_translation: existingWordMap.get(word) || ''
        };
    });

    const newWordsToTranslate = wordsToUpsert.filter(w => w.chinese_translation === '');
    const translatedPromises = newWordsToTranslate.map(word => 
        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=zh-CN&dt=t&q=${encodeURIComponent(word.spanish_word)}`)
            .then(res => res.json())
            .then(data => ({
                ...word,
                chinese_translation: data[0][0][0]
            }))
            .catch(error => {
                console.error(`Failed to translate word "${word.spanish_word}":`, error);
                return null;
            })
    );
    const translatedResults = (await Promise.all(translatedPromises)).filter(Boolean);

    // 5. Merge new translations into the final upsert list
    const finalWordsToUpsert = wordsToUpsert.map(word => {
        const translated = translatedResults.find(t => t.spanish_word === word.spanish_word);
        return translated || word;
    });

    if (finalWordsToUpsert.length > 0) {
        const { error: upsertError } = await _supabase
            .from('high_frequency_words')
            .upsert(finalWordsToUpsert, { onConflict: 'spanish_word' });

        if (upsertError) {
            console.error('Supabase 词汇更新错误:', upsertError);
        } else {
            console.log('高频词汇表更新成功。');
        }
    }
}


// === Index Page Functions ===

function filterAndSortSentences() {
    let filtered = allSentences;
    const filterValue = statusFilter.value;
    const sortValue = sortOrder.value;

    if (filterValue === 'unmastered') {
        filtered = allSentences.filter(s => !s.mastered);
    } else if (filterValue === 'mastered') {
        filtered = allSentences.filter(s => s.mastered);
    }

    if (sortValue === 'random') {
        filtered = filtered.sort(() => Math.random() - 0.5);
    } else {
        // Sequential order, which is the default from the database query
    }
    
    currentFilteredSentences = filtered;
    currentIndex = 0;
    renderSentenceCard();
}

function renderSentenceCard() {
    if (!sentenceCardContainer || !indexSpanishText || !indexChineseText) return;

    if (currentFilteredSentences.length === 0) {
        sentenceCardContainer.style.display = 'none';
        emptyMessage.style.display = 'block';
        if (statusFilter.value === 'mastered') {
            emptyMessage.innerText = '您还没有掌握任何句子！';
        } else if (statusFilter.value === 'unmastered' && allSentences.length > 0) {
            emptyMessage.innerText = '恭喜！所有句子都已掌握。';
        } else {
            emptyMessage.innerText = '当前没有句子。请前往管理页面添加。';
        }
        return;
    }
    sentenceCardContainer.style.display = 'flex';
    emptyMessage.style.display = 'none';
    const currentSentence = currentFilteredSentences[currentIndex];
    indexSpanishText.innerText = currentSentence.spanish_text;
    indexChineseText.innerText = currentSentence.chinese_translation;
    notesTextarea.value = currentSentence.notes || '';
    
    // Update mastered button state
    if (indexMasteredBtn) {
        if (currentSentence.mastered) {
            indexMasteredBtn.classList.add('mastered');
        } else {
            indexMasteredBtn.classList.remove('mastered');
        }
        indexMasteredBtn.onclick = () => toggleMastered(currentSentence.id, !currentSentence.mastered);
    }

    // Update event listeners for the current sentence
    if (indexReadBtn) indexReadBtn.onclick = () => readTextWithSupabase(currentSentence.spanish_text, false, indexReadBtn);
    if (indexSlowReadBtn) indexSlowReadBtn.onclick = () => readTextWithSupabase(currentSentence.spanish_text, true, indexSlowReadBtn);
    if (indexWordReadBtn) indexWordReadBtn.onclick = () => readWordByWord(currentSentence.spanish_text);
    if (indexAiExplainBtn) indexAiExplainBtn.onclick = () => getAiExplanation(currentSentence.spanish_text);
}

async function fetchAllSentences() {
    if (!sentenceCardContainer) return;
    sentenceCardContainer.style.display = 'none';
    emptyMessage.innerText = '加载中...';
    emptyMessage.style.display = 'block';

    const { data, error } = await _supabase
        .from('sentences')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Failed to fetch sentences:', error);
        emptyMessage.innerText = `加载失败，请检查网络。错误信息：${error.message}`;
        return;
    }
    allSentences = data;
    filterAndSortSentences();
}

async function toggleMastered(id, newStatus) {
    const { error } = await _supabase
        .from('sentences')
        .update({ mastered: newStatus })
        .eq('id', id);

    if (error) {
        console.error('Failed to update status:', error);
        showCustomConfirm('更新掌握状态失败，请检查控制台了解详情。').then(() => {});
    } else {
        const sentenceToUpdate = allSentences.find(s => s.id === id);
        if (sentenceToUpdate) {
            sentenceToUpdate.mastered = newStatus;
        }
        if (indexMasteredBtn) {
            if (newStatus) {
                indexMasteredBtn.classList.add('mastered');
            } else {
                indexMasteredBtn.classList.remove('mastered');
            }
        }
    }
}

async function saveNotes() {
    if (currentFilteredSentences.length === 0) return;
    const currentSentence = currentFilteredSentences[currentIndex];
    const newNotes = notesTextarea.value.trim();
    if (newNotes === currentSentence.notes) return;
    
    const { error } = await _supabase
        .from('sentences')
        .update({ notes: newNotes })
        .eq('id', currentSentence.id);

    if (error) {
        console.error('Failed to save notes:', error);
    }
}

// === Vocabulary Page Functions ===
async function fetchHighFrequencyWords() {
    if (!wordCardContainer) return;
    wordCardContainer.style.display = 'none';
    emptyVocabularyMessage.style.display = 'block';
    emptyVocabularyMessage.innerText = '加载中...';

    const { data, error } = await _supabase
        .from('high_frequency_words')
        .select('*');
    
    if (error) {
        console.error('Failed to fetch high frequency words:', error);
        emptyVocabularyMessage.innerText = `加载失败，请检查网络。错误信息：${error.message}`;
        return;
    }
    allWords = data;
    filterAndSortWords();
}

function filterAndSortWords() {
    let filtered = allWords;
    const filterValue = wordStatusFilter.value;
    const sortValue = wordSortOrder.value;

    if (filterValue === 'unmastered') {
        filtered = allWords.filter(w => !w.mastered);
    } else if (filterValue === 'mastered') {
        filtered = allWords.filter(w => w.mastered);
    }
    
    if (sortValue === 'random') {
        filtered = filtered.sort(() => Math.random() - 0.5);
    } else {
        filtered.sort((a, b) => b.frequency - a.frequency);
    }
    
    currentFilteredWords = filtered;
    currentWordIndex = 0;
    renderWordCard();
}

function renderWordCard() {
    if (!wordCardContainer || !spanishWord || !chineseTranslation || !wordSourceSentence) return;
    
    if (currentFilteredWords.length === 0) {
        wordCardContainer.style.display = 'none';
        emptyVocabularyMessage.style.display = 'block';
        if (wordStatusFilter.value === 'mastered') {
            emptyVocabularyMessage.innerText = '您还没有掌握任何词汇！';
        } else if (wordStatusFilter.value === 'unmastered' && allWords.length > 0) {
            emptyVocabularyMessage.innerText = '恭喜！所有词汇都已掌握。';
        } else {
            emptyVocabularyMessage.innerText = '暂无高频词汇，请先添加一些句子。';
        }
        return;
    }
    wordCardContainer.style.display = 'flex';
    emptyVocabularyMessage.style.display = 'none';
    
    const currentWord = currentFilteredWords[currentWordIndex];
    spanishWord.innerText = currentWord.spanish_word;
    chineseTranslation.innerText = currentWord.chinese_translation;
    wordSourceSentence.innerText = currentWord.source_sentence;
    
    if (wordReadBtn) {
        wordReadBtn.onclick = () => readTextWithSupabase(currentWord.spanish_word, false, wordReadBtn);
    }
    if (wordSlowReadBtn) {
        wordSlowReadBtn.onclick = () => readTextWithSupabase(currentWord.spanish_word, true, wordSlowReadBtn);
    }
    
    const wordMasteredBtn = document.getElementById('word-mastered-btn');
    if (wordMasteredBtn) {
        if (currentWord.mastered) {
            wordMasteredBtn.classList.add('mastered');
        } else {
            wordMasteredBtn.classList.remove('mastered');
        }
        wordMasteredBtn.onclick = () => toggleWordMastered(currentWord.spanish_word, !currentWord.mastered);
    }
}

async function toggleWordMastered(word, newStatus) {
    const { error } = await _supabase
        .from('high_frequency_words')
        .update({ mastered: newStatus })
        .eq('spanish_word', word);

    if (error) {
        console.error('Failed to update word status:', error);
        showCustomConfirm('更新掌握状态失败，请检查控制台了解详情。').then(() => {});
    } else {
        const wordToUpdate = allWords.find(w => w.spanish_word === word);
        if (wordToUpdate) {
            wordToUpdate.mastered = newStatus;
        }
        const wordMasteredBtn = document.getElementById('word-mastered-btn');
        if (wordMasteredBtn) {
            if (newStatus) {
                wordMasteredBtn.classList.add('mastered');
            } else {
                wordMasteredBtn.classList.remove('mastered');
            }
        }
    }
}

// === Manage Page Functions ===
async function fetchSentences() {
    if (!sentenceList) return;
    sentenceList.innerHTML = `<p class="empty-list-message">加载中...</p>`;
    
    const { data, error } = await _supabase
        .from('sentences')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Failed to fetch sentences:', error);
        sentenceList.innerHTML = `<p class="empty-list-message">加载失败，请检查您的网络或稍后再试。错误信息：${error.message}</p>`;
        return;
    }
    allSentences = data;
    renderManageSentences(allSentences);
}

function renderManageSentences(sentencesToRender) {
    if (!sentenceList) return;
    sentenceList.innerHTML = '';
    
    if (sentencesToRender.length === 0) {
        sentenceList.innerHTML = `<p class="empty-list-message">没有句子，快去添加一些吧！</p>`;
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }

    sentencesToRender.forEach(sentence => {
        const li = document.createElement('li');
        li.className = 'sentence-item';
        li.dataset.id = sentence.id;
        li.innerHTML = `
            <input type="checkbox" class="sentence-checkbox">
            <div class="sentence-text">
                <span class="spanish">${sentence.spanish_text}</span>
                <span class="chinese">${sentence.chinese_translation}</span>
            </div>
            <div class="sentence-actions">
                <button class="action-btn edit-btn" title="编辑">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button class="action-btn save-btn" title="保存">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button class="action-btn cancel-btn" title="取消">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <button class="action-btn delete-btn" title="删除">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        `;
        const editBtn = li.querySelector('.edit-btn');
        const saveBtn = li.querySelector('.save-btn');
        const cancelBtn = li.querySelector('.cancel-btn');
        const deleteBtn = li.querySelector('.delete-btn');
        
        editBtn.addEventListener('click', () => enableEditMode(li, sentence));
        saveBtn.addEventListener('click', () => saveSentence(li, sentence.id));
        cancelBtn.addEventListener('click', () => disableEditMode(li, sentence));
        deleteBtn.addEventListener('click', () => deleteSentence(sentence.id));
        
        sentenceList.appendChild(li);
    });
}

function liveSearch() {
    const searchTerm = sentenceSearch.value.toLowerCase();
    const filteredSentences = allSentences.filter(sentence => {
        return sentence.spanish_text.toLowerCase().includes(searchTerm) ||
               sentence.chinese_translation.toLowerCase().includes(searchTerm);
    });
    renderManageSentences(filteredSentences);
}


function enableEditMode(li, sentence) {
    li.classList.add('edit-mode');
    const spanishSpan = li.querySelector('.spanish');
    const chineseSpan = li.querySelector('.chinese');
    
    spanishSpan.innerHTML = `<input type="text" class="edit-spanish" value="${spanishSpan.innerText}">`;
    chineseSpan.innerHTML = `<input type="text" class="edit-chinese" value="${chineseSpan.innerText}">`;
}

function disableEditMode(li, sentence) {
    li.classList.remove('edit-mode');
    const spanishSpan = li.querySelector('.spanish');
    const chineseSpan = li.querySelector('.chinese');
    
    spanishSpan.innerText = sentence.spanish_text;
    chineseSpan.innerText = sentence.chinese_translation;
}

async function saveSentence(li, id) {
    const spanishInput = li.querySelector('.edit-spanish');
    const chineseInput = li.querySelector('.edit-chinese');
    
    if (!spanishInput || !chineseInput) return;
    
    const newSpanishText = spanishInput.value.trim();
    const newChineseText = chineseInput.value.trim();
    
    if (!newSpanishText || !newChineseText) {
        showCustomConfirm('西班牙语和中文都不能为空！').then(() => {});
        return;
    }
    
    const { error } = await _supabase
        .from('sentences')
        .update({ 
            spanish_text: newSpanishText, 
            chinese_translation: newChineseText 
        })
        .eq('id', id);
        
    if (error) {
        console.error('Failed to update sentence:', error);
        showCustomConfirm('更新失败，请检查控制台。').then(() => {});
    } else {
        showCustomConfirm('句子更新成功！').then(() => {
            fetchSentences();
            generateAndUpdateHighFrequencyWords();
        });
    }
}

async function addSentences() {
    const inputText = batchInput.value.trim();
    if (!inputText) {
        showCustomConfirm('输入内容不能为空！', true).then(() => {});
        return;
    }
    
    const EXPLAIN_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence`;
    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const sentencesToProcess = lines.map(line => ({ spanish_text: line }));
    
    // Show loading indicator
    showCustomConfirm('正在添加和翻译句子，请稍候...', false);

    const { data: existingSentences, error: fetchError } = await _supabase.from('sentences').select('spanish_text');
    if (fetchError) {
        console.error('Failed to fetch existing sentences:', fetchError);
        showCustomConfirm('获取现有句子失败，无法检查重复。', true);
        return;
    }
    const existingTextSet = new Set(existingSentences.map(s => s.spanish_text));
    const sentencesToAdd = sentencesToProcess.filter(s => !existingTextSet.has(s.spanish_text));
    const duplicateCount = sentencesToProcess.length - sentencesToAdd.length;
    
    if (sentencesToAdd.length > 0) {
        const payload = { sentences: sentencesToAdd, getTranslation: true };
        const response = await fetch(EXPLAIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error('Supabase Explain API error:', errorDetails);
            showCustomConfirm('批量添加失败：翻译服务出错。', true);
            return;
        }

        const data = await response.json();
        const translatedSentences = data.translatedSentences;

        const { error: insertError } = await _supabase
            .from('sentences')
            .insert(translatedSentences);

        if (insertError) {
            console.error('Supabase insert error:', insertError);
            showCustomConfirm('添加失败，请检查控制台了解详情。', true);
        } else {
            batchInput.value = '';
            let message = `成功添加 ${translatedSentences.length} 个句子。`;
            if (duplicateCount > 0) {
                message += ` 发现 ${duplicateCount} 个重复句子，已忽略。`;
            }
            showCustomConfirm(message, true).then(() => {
                fetchSentences();
                generateAndUpdateHighFrequencyWords();
            });
        }
    } else {
        showCustomConfirm(`没有新的句子可添加。发现 ${duplicateCount} 个重复句子。`, true).then(() => {});
    }
}

async function deleteSentence(id) {
    const confirmation = await showCustomConfirm('确定要删除这个句子吗？此操作无法撤销。');
    if (confirmation) {
        const { error } = await _supabase
            .from('sentences')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Failed to delete sentence:', error);
            showCustomConfirm('删除失败，请检查控制台。', true);
        } else {
            await generateAndUpdateHighFrequencyWords();
            fetchSentences();
        }
    }
}

async function deleteSelectedSentences() {
    const checkedBoxes = document.querySelectorAll('.sentence-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showCustomConfirm('请先选择至少一个句子进行删除。', true);
        return;
    }

    const confirmation = await showCustomConfirm(`确定要删除选中的 ${checkedBoxes.length} 个句子吗？此操作无法撤销。`);
    if (confirmation) {
        const idsToDelete = Array.from(checkedBoxes).map(cb => Number(cb.closest('.sentence-item').dataset.id));
        
        const { error } = await _supabase
            .from('sentences')
            .delete()
            .in('id', idsToDelete);
        
        if (error) {
            console.error('Failed to bulk delete sentences:', error);
            showCustomConfirm('批量删除失败，请检查控制台。', true);
        } else {
            await generateAndUpdateHighFrequencyWords();
            fetchSentences();
        }
    }
}

// === Event listeners and initialization ===
window.addEventListener('load', () => {
    if (isIndexPage) {
        fetchAllSentences();
        if (statusFilter) statusFilter.addEventListener('change', filterAndSortSentences);
        if (sortOrder) sortOrder.addEventListener('change', filterAndSortSentences);

        if (sentenceCardContainer) {
            sentenceCardContainer.addEventListener('click', (event) => {
                if (event.target.closest('button')) {
                    return;
                }
                currentIndex = (currentIndex < currentFilteredSentences.length - 1) ? currentIndex + 1 : 0;
                renderSentenceCard();
                const currentSentence = currentFilteredSentences[currentIndex];
                readTextWithSupabase(currentSentence.spanish_text, false, indexReadBtn);
            });
        }
        
        if (prevSentenceBtn) {
            prevSentenceBtn.addEventListener('click', () => {
                currentIndex = (currentIndex > 0) ? currentIndex - 1 : currentFilteredSentences.length - 1;
                renderSentenceCard();
            });
        }
        if (nextSentenceBtn) {
            nextSentenceBtn.addEventListener('click', () => {
                currentIndex = (currentIndex < currentFilteredSentences.length - 1) ? currentIndex + 1 : 0;
                renderSentenceCard();
            });
        }

        if (notesTextarea) {
            notesTextarea.addEventListener('change', saveNotes);
        }
    } else if (isManagePage) {
        fetchSentences();
        if (addBatchBtn) addBatchBtn.addEventListener('click', addSentences);
        if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelectedSentences);
        if (sentenceSearch) sentenceSearch.addEventListener('input', liveSearch);
    } else if (isVocabularyPage) {
        fetchHighFrequencyWords();
        if (wordStatusFilter) wordStatusFilter.addEventListener('change', filterAndSortWords);
        if (wordSortOrder) wordSortOrder.addEventListener('change', filterAndSortWords);
        
        if (wordCardContainer) {
            wordCardContainer.addEventListener('click', (event) => {
                if (event.target.closest('button')) {
                    return;
                }
                currentWordIndex = (currentWordIndex < currentFilteredWords.length - 1) ? currentWordIndex + 1 : 0;
                renderWordCard();
                const currentWord = currentFilteredWords[currentWordIndex];
                readTextWithSupabase(currentWord.spanish_word, false, wordReadBtn);
            });
        }
        
        if (prevWordBtn) {
            prevWordBtn.addEventListener('click', () => {
                currentWordIndex = (currentWordIndex > 0) ? currentWordIndex - 1 : currentFilteredWords.length - 1;
                renderWordCard();
            });
        }
        if (nextWordBtn) {
            nextWordBtn.addEventListener('click', () => {
                currentWordIndex = (currentWordIndex < currentFilteredWords.length - 1) ? currentWordIndex + 1 : 0;
                renderWordCard();
            });
        }
    }
});