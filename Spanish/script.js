// === 1. Configure Supabase client ===
const SUPABASE_URL = 'https://rvarfascuwvponxwdeoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2YXJmYXNjdXd2cG9ueHdkZW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNDE5MDcsImV4cCI6MjA3MTgxNzkwN30.KdBVtNYdOw9n8351FWlAgAPCv0WmSnr9vOGgtHCRSnc';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === 2. Getting DOM elements ===
const isIndexPage = document.getElementById('sentence-card-container') !== null;
const isManagePage = document.body.classList.contains('manage-page');
const isVocabularyPage = document.getElementById('word-card-container') !== null;

// Index Page elements
const statusFilterGroup = document.getElementById('status-filter-group');
const sortOrderGroup = document.getElementById('sort-order-group');
const sentenceCardContainer = document.getElementById('sentence-card-container');
const sentenceCard = document.getElementById('sentence-card');
const emptyMessage = document.getElementById('empty-message');
const indexSpanishText = sentenceCard?.querySelector('.spanish');
const indexChineseText = sentenceCard?.querySelector('.chinese');
const indexReadBtn = sentenceCard?.querySelector('#index-read-btn');
const indexSlowReadBtn = sentenceCard?.querySelector('#index-slow-read-btn');
const indexWordReadBtn = sentenceCard?.querySelector('#index-word-read-btn');
const indexAiExplainBtn = sentenceCard?.querySelector('#index-ai-explain-btn');
const indexMasteredBtn = sentenceCard?.querySelector('#index-mastered-btn');
const utilityMenuBtn = document.getElementById('utility-menu-btn');
const utilityMenu = document.getElementById('utility-menu');
const addSentenceBtn = document.getElementById('add-sentence-btn');
const editSentenceBtn = document.getElementById('edit-sentence-btn');
const deleteSentenceBtn = document.getElementById('delete-sentence-btn');
const addSentenceModal = document.getElementById('addSentenceModal');
const editSentenceModal = document.getElementById('editSentenceModal');
const addSentenceForm = document.getElementById('add-sentence-form');
const editSentenceForm = document.getElementById('edit-sentence-form');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Manage Page elements
const batchInput = document.getElementById('batch-input');
const addBatchBtn = document.getElementById('add-batch-button');
const sentenceList = document.getElementById('sentence-list');
const sentenceSearch = document.getElementById('sentence-search');
let allSentences = []; 

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
let allWords = [];


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
let wordTranslationMap = new Map();

let currentStatusFilter = 'unmastered';
let currentSortOrder = 'sequential';
let isSingleSentenceMode = false;

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

async function readTextWithSupabase(text, isSlow = false, button) {
    const TTS_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/tts`;
    const request = { text: text, isSlow: isSlow };

    document.querySelectorAll('.icon-btn, .highlight-word').forEach(btn => btn.classList.remove('playing'));
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
            if (!response.ok) return response.text().then(text => { throw new Error(`Supabase TTS API error: ${text}`); });
            return response.json();
        }).then(data => {
            audio.src = `data:audio/mp3;base64,${data.audioContent}`;
            audio.play();
        }).catch(error => {
            console.error('Failed to fetch from Supabase TTS:', error);
            if (button) button.classList.remove('playing');
            reject(error);
        });
    });
}


// === Index Page Functions ===

function filterAndSortSentences() {
    let filtered = allSentences;
    
    // 1. Handle "Single Sentence" mode first
    if (currentSortOrder === 'single') {
        isSingleSentenceMode = true;
        const singleSentence = currentFilteredSentences[currentIndex] || allSentences[0];
        currentFilteredSentences = singleSentence ? [singleSentence] : [];
        currentIndex = 0;
        if(sentenceCard) sentenceCard.classList.add('is-locked');
        renderSentenceCard();
        return;
    }
    
    isSingleSentenceMode = false;
    if(sentenceCard) sentenceCard.classList.remove('is-locked');

    // 2. Apply status filter
    if (currentStatusFilter === 'unmastered') {
        filtered = allSentences.filter(s => !s.mastered);
    } else if (currentStatusFilter === 'mastered') {
        filtered = allSentences.filter(s => s.mastered);
    }

    // 3. Apply sort order
    if (currentSortOrder === 'random') {
        filtered = filtered.sort(() => Math.random() - 0.5);
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
        if(utilityMenuBtn) utilityMenuBtn.style.display = 'none';
        if (currentStatusFilter === 'mastered') emptyMessage.innerText = '您还没有掌握任何句子！';
        else if (currentStatusFilter === 'unmastered' && allSentences.length > 0) emptyMessage.innerText = '恭喜！所有句子都已掌握。';
        else emptyMessage.innerText = '当前没有句子，请点击右下角“...”按钮添加。';
        return;
    }
    sentenceCardContainer.style.display = 'flex';
    if(utilityMenuBtn) utilityMenuBtn.style.display = 'flex';
    emptyMessage.style.display = 'none';

    const currentSentence = currentFilteredSentences[currentIndex];
    
    const sentenceText = currentSentence.spanish_text;
    const tokens = sentenceText.split(/([,;!?."\s¿¡—:-])/);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;

    const htmlParts = tokens.map(token => {
        const cleanToken = token.toLowerCase().replace(punctuationRegex, '').trim();
        if (wordTranslationMap.has(cleanToken)) {
            const translation = wordTranslationMap.get(cleanToken);
            return `<span class="highlight-word" data-word="${cleanToken}" title="${translation}">${token}</span>`;
        }
        return token;
    });

    indexSpanishText.innerHTML = htmlParts.join('');
    indexChineseText.innerText = currentSentence.chinese_translation;

    if (indexMasteredBtn) {
        indexMasteredBtn.classList.toggle('mastered', currentSentence.mastered);
        indexMasteredBtn.onclick = () => toggleMastered(currentSentence.id, !currentSentence.mastered);
    }

    if (indexReadBtn) indexReadBtn.onclick = () => readTextWithSupabase(currentSentence.spanish_text, false, indexReadBtn);
    if (indexSlowReadBtn) indexSlowReadBtn.onclick = () => readTextWithSupabase(currentSentence.spanish_text, true, indexSlowReadBtn);
    if (indexWordReadBtn) indexWordReadBtn.onclick = () => readWordByWord(currentSentence.spanish_text);
    if (indexAiExplainBtn) indexAiExplainBtn.onclick = () => getAiExplanation();
}

// === FIX: The missing function definition is added here ===
async function fetchAndMapWords() {
    const { data, error } = await _supabase
        .from('high_frequency_words')
        .select('spanish_word, chinese_translation');
    
    if (error) {
        console.error('Failed to fetch words for map:', error);
        return;
    }

    wordTranslationMap.clear();
    data.forEach(word => {
        wordTranslationMap.set(word.spanish_word, word.chinese_translation);
    });
    console.log(`Word translation map populated with ${wordTranslationMap.size} words.`);
}
// === END FIX ===

async function fetchAllSentences() {
    if (!isIndexPage && !isManagePage) return; 
    if(isIndexPage){
        sentenceCardContainer.style.display = 'none';
        emptyMessage.innerText = '加载中...';
        emptyMessage.style.display = 'block';
    }

    const { data, error } = await _supabase.from('sentences').select('*').order('id', { ascending: true });

    if (error) {
        console.error('Failed to fetch sentences:', error);
        if (isIndexPage) emptyMessage.innerText = `加载失败: ${error.message}`;
        if (isManagePage) sentenceList.innerHTML = `<p class="empty-list-message">加载失败: ${error.message}</p>`;
        return;
    }
    allSentences = data;
    if (isIndexPage) filterAndSortSentences();
    if (isManagePage) renderManageSentences(allSentences);
}

async function toggleMastered(id, newStatus) {
    const { error } = await _supabase.from('sentences').update({ mastered: newStatus }).eq('id', id);
    if (error) return console.error('Failed to update status:', error);
    const sentenceToUpdate = allSentences.find(s => s.id === id);
    if (sentenceToUpdate) sentenceToUpdate.mastered = newStatus;
    if (indexMasteredBtn) indexMasteredBtn.classList.toggle('mastered', newStatus);
}

async function deleteCurrentSentence() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToDelete = currentFilteredSentences[currentIndex];

    const confirmation = await showCustomConfirm(`确定要删除这个句子吗？\n"${sentenceToDelete.spanish_text}"`);
    if (confirmation) {
        const { error } = await _supabase.from('sentences').delete().eq('id', sentenceToDelete.id);
        if (error) {
            console.error('Failed to delete sentence:', error);
            showCustomConfirm('删除失败，请检查控制台。');
        } else {
            showCustomConfirm('删除成功！', false);
            setTimeout(() => confirmModal.style.display = 'none', 1000);
            await Promise.all([fetchAllSentences(), generateAndUpdateHighFrequencyWords()]);
        }
    }
}

async function handleAddSentence(event) {
    event.preventDefault();
    const spanishText = document.getElementById('new-spanish-text').value.trim();
    const chineseText = document.getElementById('new-chinese-text').value.trim();

    if (!spanishText || !chineseText) {
        showCustomConfirm('西班牙语和中文翻译均不能为空！');
        return;
    }
    
    const newSentence = { spanish_text: spanishText, chinese_translation: chineseText };
    const { error } = await _supabase.from('sentences').insert([newSentence]);

    if (error) {
        console.error('Failed to add sentence:', error);
        showCustomConfirm(`添加失败: ${error.message}`);
    } else {
        addSentenceModal.style.display = 'none';
        addSentenceForm.reset();
        showCustomConfirm('添加成功！', false);
        setTimeout(() => confirmModal.style.display = 'none', 1000);
        await Promise.all([fetchAllSentences(), generateAndUpdateHighFrequencyWords()]);
    }
}

function openEditModal() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToEdit = currentFilteredSentences[currentIndex];
    document.getElementById('edit-sentence-id').value = sentenceToEdit.id;
    document.getElementById('edit-spanish-text').value = sentenceToEdit.spanish_text;
    document.getElementById('edit-chinese-text').value = sentenceToEdit.chinese_translation;
    editSentenceModal.style.display = 'flex';
}

async function handleEditSentence(event) {
    event.preventDefault();
    const id = document.getElementById('edit-sentence-id').value;
    const spanishText = document.getElementById('edit-spanish-text').value.trim();
    const chineseText = document.getElementById('edit-chinese-text').value.trim();

    if (!spanishText || !chineseText) {
        showCustomConfirm('西班牙语和中文翻译均不能为空！');
        return;
    }
    
    const originalSentence = allSentences.find(s => s.id == id);
    let updateData = { spanish_text: spanishText, chinese_translation: chineseText };
    if (originalSentence && originalSentence.spanish_text !== spanishText) {
        updateData.ai_notes = null;
    }

    const { error } = await _supabase.from('sentences').update(updateData).eq('id', id);

    if (error) {
        console.error('Failed to update sentence:', error);
        showCustomConfirm(`更新失败: ${error.message}`);
    } else {
        editSentenceModal.style.display = 'none';
        editSentenceForm.reset();
        showCustomConfirm('更新成功！', false);
        setTimeout(() => confirmModal.style.display = 'none', 1000);
        await Promise.all([fetchAllSentences(), generateAndUpdateHighFrequencyWords()]);
    }
}

// === Other Page Functions... ===
// (No changes to Vocabulary or Manage page functions)
function renderManageSentences(sentencesToRender) {
    if (!sentenceList) return;
    sentenceList.innerHTML = '';

    if (sentencesToRender.length === 0) {
        sentenceList.innerHTML = `<p class="empty-list-message">没有句子。</p>`;
        return;
    }
    sentencesToRender.forEach(sentence => {
        const li = document.createElement('li');
        li.className = 'sentence-item';
        li.dataset.id = sentence.id;
        li.innerHTML = `
            <div class="sentence-text">
                <span class="spanish">${sentence.spanish_text}</span>
                <span class="chinese">${sentence.chinese_translation}</span>
            </div>
        `;
        sentenceList.appendChild(li);
    });
}
async function addSentences() { 
    const lines = batchInput.value.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return showCustomConfirm('输入内容不能为空！');

    showCustomConfirm('正在处理，请稍候...', false);

    const { data: existing, error: fetchError } = await _supabase.from('sentences').select('spanish_text');
    if (fetchError) return showCustomConfirm('获取现有句子失败。');
    
    const existingSet = new Set(existing.map(s => s.spanish_text));
    const toAdd = lines.map(line => ({ spanish_text: line.trim() })).filter(s => !existingSet.has(s.spanish_text));
    const duplicateCount = lines.length - toAdd.length;

    if (toAdd.length === 0) return showCustomConfirm(`没有新的句子可添加。发现 ${duplicateCount} 个重复句子。`);
    
    const EXPLAIN_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence`;
    const payload = { sentences: toAdd, getTranslation: true };
    const response = await fetch(EXPLAIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    if (!response.ok) {
        console.error('API error:', await response.text());
        return showCustomConfirm('批量添加失败：翻译服务出错。');
    }

    const { translatedSentences } = await response.json();
    const { error: insertError } = await _supabase.from('sentences').insert(translatedSentences);

    if (insertError) {
        console.error('Supabase insert error:', insertError);
        showCustomConfirm('添加失败，请检查控制台。');
    } else {
        batchInput.value = '';
        let message = `成功添加 ${translatedSentences.length} 个句子。`;
        if (duplicateCount > 0) message += ` 忽略了 ${duplicateCount} 个重复句子。`;
        showCustomConfirm(message).then(() => {
            fetchAllSentences();
            generateAndUpdateHighFrequencyWords();
        });
    }
}


// === Event listeners and initialization ===
window.addEventListener('load', () => {
    if (isIndexPage) {
        // The call on line 202 that was causing the error
        Promise.all([fetchAllSentences(), fetchAndMapWords()]); 
        
        if (statusFilterGroup) {
            statusFilterGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    currentStatusFilter = e.target.dataset.value;
                    statusFilterGroup.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    filterAndSortSentences();
                }
            });
        }

        if (sortOrderGroup) {
            sortOrderGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    currentSortOrder = e.target.dataset.value;
                    sortOrderGroup.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    filterAndSortSentences();
                }
            });
        }

        if (sentenceCard) {
            sentenceCard.addEventListener('click', (event) => {
                if (isSingleSentenceMode || event.target.closest('button') || event.target.classList.contains('highlight-word')) {
                    return;
                }
                const rect = sentenceCard.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                if (event.clientX < midpoint) {
                    currentIndex = (currentIndex > 0) ? currentIndex - 1 : currentFilteredSentences.length - 1;
                    renderSentenceCard();
                } else {
                    currentIndex = (currentIndex < currentFilteredSentences.length - 1) ? currentIndex + 1 : 0;
                    renderSentenceCard();
                    const currentSentence = currentFilteredSentences[currentIndex];
                    if (currentSentence) {
                       readTextWithSupabase(currentSentence.spanish_text, false, indexReadBtn);
                    }
                }
            });
        }
        
        if (indexSpanishText) {
            indexSpanishText.addEventListener('click', (event) => {
                if (event.target.classList.contains('highlight-word')) {
                    event.stopPropagation();
                    const wordToRead = event.target.dataset.word;
                    readTextWithSupabase(wordToRead, false, event.target);
                }
            });
        }

        if(utilityMenuBtn) {
            utilityMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                utilityMenu.classList.toggle('visible');
            });
        }
        document.addEventListener('click', () => {
            if(utilityMenu) utilityMenu.classList.remove('visible');
        });

        if (addSentenceBtn) addSentenceBtn.addEventListener('click', () => addSentenceModal.style.display = 'flex');
        if (editSentenceBtn) editSentenceBtn.addEventListener('click', openEditModal);
        if (deleteSentenceBtn) deleteSentenceBtn.addEventListener('click', deleteCurrentSentence);
        
        if (addSentenceForm) addSentenceForm.addEventListener('submit', handleAddSentence);
        if (editSentenceForm) editSentenceForm.addEventListener('submit', handleEditSentence);

        if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => addSentenceModal.style.display = 'none');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => editSentenceModal.style.display = 'none');

    } else if (isManagePage) {
        fetchAllSentences();
        if (addBatchBtn) addBatchBtn.addEventListener('click', addSentences);
        // ... (rest of manage page listeners)
    } else if (isVocabularyPage) {
        // ... (vocabulary page listeners)
    }
});