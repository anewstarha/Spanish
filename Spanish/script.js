// === 页面保护 ===
document.addEventListener('DOMContentLoaded', () => {
    if (typeof protectPage === 'function') {
        protectPage();
    }
});

// === 1. 配置 Supabase 客户端 ===
const _supabase = window.supabaseClient;

// === 2. 获取 DOM 元素 ===
// ... (所有 DOM 元素获取部分保持不变) ...
const isIndexPage = document.body.id === 'index-page';
const isManagePage = document.body.classList.contains('manage-page');
const isVocabularyPage = !!document.getElementById('word-card-container');
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
const masteredToggle = document.getElementById('mastered-toggle');
const addSentenceLink = document.getElementById('add-sentence-link');
const editSentenceLink = document.getElementById('edit-sentence-link');
const deleteSentenceLink = document.getElementById('delete-sentence-link');
const addSentenceModal = document.getElementById('addSentenceModal');
const editSentenceModal = document.getElementById('editSentenceModal');
const addSentenceForm = document.getElementById('add-sentence-form');
const editSentenceForm = document.getElementById('edit-sentence-form');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const batchInput = document.getElementById('batch-input');
const addBatchBtn = document.getElementById('add-batch-button');
const sentenceList = document.getElementById('sentence-list');
const sentenceSearch = document.getElementById('sentence-search');
let allSentences = []; 
const wordCardContainer = document.getElementById('word-card-container');
const wordCard = document.getElementById('word-card');
const emptyVocabularyMessage = document.getElementById('empty-vocabulary-message');
const wordReadBtn = wordCard?.querySelector('#word-read-btn');
const wordSlowReadBtn = wordCard?.querySelector('#word-slow-read-btn');
const spanishWordText = wordCard?.querySelector('.spanish #word-text');
const wordFrequencyBadge = document.getElementById('word-frequency-badge');
const chineseTranslation = wordCard?.querySelector('.chinese');
const wordSourceSentence = wordCard?.querySelector('.source-sentence');
const wordStatusFilterGroup = document.getElementById('word-status-filter-group');
const wordSortOrderGroup = document.getElementById('word-sort-order-group');
const wordMasteredToggle = document.getElementById('word-mastered-toggle');
let allWords = [];
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const aiExplanationModal = document.getElementById('aiExplanationModal');
const aiExplanationTitle = document.getElementById('aiExplanationTitle');
const aiExplanationContent = document.getElementById('aiExplanationContent');
const aiExplanationCloseBtn = document.getElementById('aiExplanationCloseBtn');
const sentenceListModal = document.getElementById('sentenceListModal');
const sentenceListTitle = document.getElementById('sentenceListTitle');
const sentenceListContent = document.getElementById('sentence-list-content');
const sentenceListCloseBtn = document.getElementById('sentenceListCloseBtn');
const audio = new Audio();
let currentFilteredSentences = [];
let currentIndex = 0;
let currentFilteredWords = [];
let currentWordIndex = 0;
let wordTranslationMap = new Map();
let currentStatusFilter = 'unmastered';
let currentSortOrder = 'sequential';
let isSingleSentenceMode = false;
let currentWordStatusFilter = 'all';
let currentWordSortOrder = 'frequency';

// === 3. 核心功能函数 ===
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
    const TTS_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/tts';
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
async function readWordByWord(sentence) {
    const words = sentence.split(/\s+/).filter(word => word.length > 0);
    if (indexWordReadBtn) indexWordReadBtn.classList.add('playing');
    try {
        for (const word of words) {
            await readTextWithSupabase(word);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } finally {
        if (indexWordReadBtn) indexWordReadBtn.classList.remove('playing');
    }
}
function showAiExplanation(title, content) {
    if (!aiExplanationModal) return;
    aiExplanationTitle.innerText = title;
    aiExplanationContent.innerHTML = content;
    aiExplanationModal.style.display = 'flex';
}
if (aiExplanationCloseBtn) {
    aiExplanationCloseBtn.addEventListener('click', () => {
        if (aiExplanationModal) aiExplanationModal.style.display = 'none';
    });
}
if(sentenceListCloseBtn) {
    sentenceListCloseBtn.addEventListener('click', () => {
        if(sentenceListModal) sentenceListModal.style.display = 'none';
    });
}
async function getAiExplanation() {
    if (currentFilteredSentences.length === 0) return;
    const currentSentence = currentFilteredSentences[currentIndex];
    const spanishSentence = currentSentence.spanish_text;
    if (currentSentence.ai_notes) {
        showAiExplanation('AI 句子解释', `<p>${currentSentence.ai_notes.replace(/\n/g, '<br>')}</p>`);
        return;
    }
    const EXPLAIN_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence';
    showAiExplanation('AI 正在生成解释', `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成解释中，请稍候...</p>`);
    try {
        const payload = { sentence: spanishSentence, getExplanation: true };
        const response = await fetch(EXPLAIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();
        const explanation = result.explanation || '未能获取 AI 解释。';
        const { error: updateError } = await _supabase
            .from('sentences')
            .update({ ai_notes: explanation })
            .eq('id', currentSentence.id);
        if (updateError) {
            console.error('Failed to save AI notes:', updateError);
        } else {
            currentSentence.ai_notes = explanation;
        }
        showAiExplanation('AI 句子解释', `<p>${explanation.replace(/\n/g, '<br>')}</p>`);
    } catch (error) {
        console.error('Failed to fetch from Supabase Explain API:', error);
        showAiExplanation('错误', `<p>无法连接到 AI 服务。错误详情: ${error.message}</p>`);
    }
}
const stopWords = new Set([
    'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre',
    'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras',
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas',
    'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha',
    'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les',
    'que', 'quien', 'cuyo', 'donde', 'como', 'cuando', 'cual'
]);
function getWordsFromSentence(sentence) {
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    return sentence.toLowerCase().replace(punctuationRegex, '').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
}
async function generateAndUpdateHighFrequencyWords(user) {
    if (!user) {
        console.error("generateAndUpdateHighFrequencyWords: User object is missing.");
        return;
    }
    console.log(`为用户 ${user.id} 开始生成高频词...`);
    const { data: allSentencesData, error: fetchAllError } = await _supabase
        .from('sentences')
        .select('spanish_text')
        .eq('user_id', user.id);
    if (fetchAllError) return console.error('获取用户句子失败:', fetchAllError);
    const { data: existingWordsInDb, error: fetchWordsError } = await _supabase
        .from('high_frequency_words')
        .select('spanish_word, chinese_translation')
        .eq('user_id', user.id);
    if (fetchWordsError) return console.error('获取用户现有词汇失败:', fetchWordsError);
    const existingWordMap = new Map((existingWordsInDb || []).map(w => [w.spanish_word, w.chinese_translation]));
    const wordCounts = {};
    const wordSourceSentences = {};
    (allSentencesData || []).flatMap(s => getWordsFromSentence(s.spanish_text)).forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        if (!wordSourceSentences[word]) {
            wordSourceSentences[word] = allSentencesData.find(s => s.spanish_text.toLowerCase().includes(word))?.spanish_text || '';
        }
    });
    const wordsToUpsert = Object.keys(wordCounts).map(word => ({
        user_id: user.id,
        spanish_word: word,
        frequency: wordCounts[word],
        source_sentence: wordSourceSentences[word],
        chinese_translation: existingWordMap.get(word) || ''
    }));
    if (wordsToUpsert.length > 0) {
        const { error: upsertError } = await _supabase
            .from('high_frequency_words')
            .upsert(wordsToUpsert, { onConflict: 'user_id, spanish_word' });
        if (upsertError) console.error('Supabase 词汇更新错误:', upsertError);
        else console.log(`成功为用户 ${user.id} 更新/插入 ${wordsToUpsert.length} 个高频词。`);
    }
}
function filterAndSortSentences(isNewFilterOrSort = true) {
    let filtered = allSentences;
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
    if (currentStatusFilter === 'unmastered') {
        filtered = allSentences.filter(s => !s.mastered);
    } else if (currentStatusFilter === 'mastered') {
        filtered = allSentences.filter(s => s.mastered);
    }
    if (currentSortOrder === 'random') {
        filtered = filtered.sort(() => Math.random() - 0.5);
    }
    currentFilteredSentences = filtered;
    if (isNewFilterOrSort) {
        currentIndex = 0;
    }
    renderSentenceCard();
}
function renderSentenceCard() {
    if (!sentenceCardContainer || !indexSpanishText || !indexChineseText) return;
    if (currentFilteredSentences.length === 0) {
        sentenceCardContainer.style.display = 'none';
        emptyMessage.style.display = 'block';
        if (currentStatusFilter === 'mastered') emptyMessage.innerText = '您还没有掌握任何句子！';
        else if (currentStatusFilter === 'unmastered' && allSentences.length > 0) emptyMessage.innerText = '恭喜！所有句子都已掌握。';
        else emptyMessage.innerText = '您的句子列表为空，请在“管理”页面添加新句子。';
        return;
    }
    sentenceCardContainer.style.display = 'flex';
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
    if (masteredToggle) {
        masteredToggle.classList.toggle('mastered', currentSentence.mastered);
    }
    if (indexReadBtn) indexReadBtn.onclick = () => readTextWithSupabase(currentSentence.spanish_text, false, indexReadBtn);
    if (indexSlowReadBtn) indexSlowReadBtn.onclick = () => readTextWithSupabase(currentSentence.spanish_text, true, indexSlowReadBtn);
    if (indexWordReadBtn) indexWordReadBtn.onclick = () => readWordByWord(currentSentence.spanish_text);
    if (indexAiExplainBtn) indexAiExplainBtn.onclick = () => getAiExplanation();
}
async function fetchAndMapWords() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await _supabase
        .from('high_frequency_words')
        .select('spanish_word, chinese_translation')
        .eq('user_id', user.id);
    if (error) {
        console.error('Failed to fetch words for map:', error);
        throw error;
    }
    wordTranslationMap.clear();
    (data || []).forEach(word => wordTranslationMap.set(word.spanish_word, word.chinese_translation));
}
async function fetchAllSentences() {
    if (!isIndexPage && !isManagePage && !isVocabularyPage) return;
    if(isIndexPage){
        sentenceCardContainer.style.display = 'none';
        emptyMessage.innerText = '加载中...';
        emptyMessage.style.display = 'block';
    }
    const { data, error } = await _supabase.from('sentences').select('*').order('id', { ascending: true });
    if (error) {
        console.error('获取句子失败:', error);
        if (emptyMessage) emptyMessage.innerText = `加载句子失败: ${error.message}`;
        allSentences = [];
    } else {
        allSentences = data || [];
    }
    if (isManagePage) {
        renderManageSentences(allSentences);
    }
}
async function toggleMastered(id, newStatus) {
    const { error } = await _supabase.from('sentences').update({ mastered: newStatus }).eq('id', id);
    if (error) return console.error('更新状态失败:', error);
    const sentenceToUpdate = allSentences.find(s => s.id === id);
    if (sentenceToUpdate) sentenceToUpdate.mastered = newStatus;
    if (masteredToggle) masteredToggle.classList.toggle('mastered', newStatus);
}
async function deleteCurrentSentence() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToDelete = currentFilteredSentences[currentIndex];
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
        showCustomConfirm('错误: 无法获取用户信息，请重新登录。');
        return;
    }
    const confirmation = await showCustomConfirm(`确定要删除这个句子吗？\n"${sentenceToDelete.spanish_text}"`);
    if (confirmation) {
        const { error } = await _supabase.from('sentences').delete().eq('id', sentenceToDelete.id);
        if (error) {
            showCustomConfirm('删除失败，请检查控制台。');
        } else {
            showCustomConfirm('删除成功！', false);
            setTimeout(() => confirmModal.style.display = 'none', 1000);
            await Promise.all([fetchAllSentences(), generateAndUpdateHighFrequencyWords(user)]);
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
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
        showCustomConfirm('错误: 无法获取用户信息，请重新登录。');
        return;
    }
    const newSentence = {
        spanish_text: spanishText,
        chinese_translation: chineseText,
        user_id: user.id
    };
    const { error } = await _supabase.from('sentences').insert([newSentence]);
    if (error) {
        showCustomConfirm(`添加失败: ${error.message}`);
    } else {
        addSentenceModal.style.display = 'none';
        addSentenceForm.reset();
        showCustomConfirm('添加成功！', false);
        setTimeout(() => confirmModal.style.display = 'none', 1000);
        await Promise.all([fetchAllSentences(), generateAndUpdateHighFrequencyWords(user)]);
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
        showCustomConfirm(`更新失败: ${error.message}`);
    } else {
        editSentenceModal.style.display = 'none';
        editSentenceForm.reset();
        showCustomConfirm('更新成功！', false);
        setTimeout(async () => {
            confirmModal.style.display = 'none';
            const { data: { user } } = await _supabase.auth.getUser();
            if(user){
                await Promise.all([fetchAllSentences(), generateAndUpdateHighFrequencyWords(user)]);
            }
        }, 1000);
    }
}
async function fetchHighFrequencyWords() {
    if (!wordCardContainer) return;
    wordCardContainer.style.display = 'none';
    if (emptyVocabularyMessage) {
        emptyVocabularyMessage.style.display = 'block';
        emptyVocabularyMessage.innerText = '加载中...';
    }
    const { data, error } = await _supabase.from('high_frequency_words').select('*');
    if (error) {
        console.error('获取高频词汇失败:', error);
        if (emptyVocabularyMessage) emptyVocabularyMessage.innerText = `加载失败. Error: ${error.message}`;
        return;
    }
    allWords = data || [];
    filterAndSortWords();
}
function filterAndSortWords() {
    let filtered = allWords;
    if (currentWordStatusFilter === 'unmastered') {
        filtered = allWords.filter(w => !w.mastered);
    } else if (currentWordStatusFilter === 'mastered') {
        filtered = allWords.filter(w => w.mastered);
    }
    if (currentWordSortOrder === 'random') {
        filtered = filtered.sort(() => Math.random() - 0.5);
    } else {
        filtered = filtered.sort((a, b) => b.frequency - a.frequency);
    }
    currentFilteredWords = filtered;
    currentWordIndex = 0;
    renderWordCard();
}
function renderWordCard() {
    if (!wordCardContainer || !spanishWordText || !chineseTranslation || !wordSourceSentence) return;
    if (currentFilteredWords.length === 0) {
        wordCardContainer.style.display = 'none';
        if (emptyVocabularyMessage) {
            emptyVocabularyMessage.style.display = 'block';
            if (currentWordStatusFilter === 'mastered') emptyVocabularyMessage.innerText = '您还没有掌握任何词汇！';
            else if (currentWordStatusFilter === 'unmastered' && allWords.length > 0) emptyVocabularyMessage.innerText = '恭喜！所有词汇都已掌握。';
            else emptyVocabularyMessage.innerText = '暂无高频词汇，请先添加一些句子。';
        }
        return;
    }
    wordCardContainer.style.display = 'flex';
    if (emptyVocabularyMessage) emptyVocabularyMessage.style.display = 'none';
    const currentWord = currentFilteredWords[currentWordIndex];
    spanishWordText.innerText = currentWord.spanish_word;
    chineseTranslation.innerText = currentWord.chinese_translation;
    wordSourceSentence.innerText = currentWord.source_sentence;
    if (wordFrequencyBadge) {
        wordFrequencyBadge.innerText = currentWord.frequency;
        wordFrequencyBadge.onclick = (e) => {
            e.stopPropagation();
            showSentencesForWord(currentWord.spanish_word);
        };
    }
    if (wordReadBtn) wordReadBtn.onclick = () => readTextWithSupabase(currentWord.spanish_word, false, wordReadBtn);
    if (wordSlowReadBtn) wordSlowReadBtn.onclick = () => readTextWithSupabase(currentWord.spanish_word, true, wordSlowReadBtn);
    if (wordMasteredToggle) {
        wordMasteredToggle.classList.toggle('mastered', currentWord.mastered);
        wordMasteredToggle.onclick = (e) => {
            e.stopPropagation();
            toggleWordMastered(currentWord.id, !currentWord.mastered);
        };
    }
}
function showSentencesForWord(word) {
    if (!sentenceListModal || !sentenceListContent || !sentenceListTitle) return;
    const matchingSentences = allSentences.filter(sentence =>
        new RegExp(`\\b${word}\\b`, 'i').test(sentence.spanish_text)
    );
    sentenceListTitle.innerText = `包含 “${word}” 的例句 (${matchingSentences.length})`;
    sentenceListContent.innerHTML = '';
    if (matchingSentences.length > 0) {
        matchingSentences.forEach(sentence => {
            const item = document.createElement('p');
            item.className = 'sentence-list-item';
            item.innerText = sentence.spanish_text;
            item.onclick = () => {
                readTextWithSupabase(sentence.spanish_text, false);
            };
            sentenceListContent.appendChild(item);
        });
    } else {
        sentenceListContent.innerHTML = '<p>暂无更多例句。</p>';
    }
    sentenceListModal.style.display = 'flex';
}
async function toggleWordMastered(id, newStatus) {
    const { error } = await _supabase.from('high_frequency_words').update({ mastered: newStatus }).eq('id', id);
    if (error) {
        console.error('更新单词状态失败:', error);
        showCustomConfirm('更新掌握状态失败。');
    } else {
        const wordToUpdate = allWords.find(w => w.id === id);
        if (wordToUpdate) wordToUpdate.mastered = newStatus;
        renderWordCard();
    }
}
function renderManageSentences(sentencesToRender) {
    if (!sentenceList) return;
    sentenceList.innerHTML = '';
    if ((sentencesToRender || []).length === 0) {
        sentenceList.innerHTML = `<p class="empty-list-message">您的句子列表为空，请在下方添加。</p>`;
        return;
    }
    (sentencesToRender || []).forEach(sentence => {
        const li = document.createElement('li');
        li.className = 'sentence-item';
        li.dataset.id = sentence.id;
        li.innerHTML = `
            <div class="sentence-text">
                <span class="spanish">${sentence.spanish_text}</span>
                <span class="chinese">${sentence.chinese_translation}</span>
            </div>
        `;
        li.addEventListener('click', () => {
            sessionStorage.setItem('targetSentenceId', sentence.id);
            window.location.href = 'index.html';
        });
        sentenceList.appendChild(li);
    });
}
async function addSentences() {
    if (addBatchBtn.classList.contains('loading')) return;
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
        showCustomConfirm('错误: 无法获取用户信息，请重新登录。');
        return;
    }
    const lines = batchInput.value.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return showCustomConfirm('输入内容不能为空！');
    addBatchBtn.classList.add('loading');
    addBatchBtn.disabled = true;
    try {
        const { data: existing, error: fetchError } = await _supabase.from('sentences').select('spanish_text');
        if (fetchError) throw fetchError;
        const existingSet = new Set(existing.map(s => s.spanish_text));
        const toAdd = lines.map(line => ({ spanish_text: line.trim() })).filter(s => !existingSet.has(s.spanish_text));
        const duplicateCount = lines.length - toAdd.length;
        if (toAdd.length === 0) {
            showCustomConfirm(`没有新的句子可添加。发现 ${duplicateCount} 个重复句子。`);
            addBatchBtn.classList.remove('loading');
            addBatchBtn.disabled = false;
            return;
        }
        const EXPLAIN_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence';
        const payload = { sentences: toAdd, getTranslation: true };
        const response = await fetch(EXPLAIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) {
            throw new Error(`翻译服务出错: ${await response.text()}`);
        }
        const { translatedSentences } = await response.json();
        const sentencesWithUserId = translatedSentences.map(sentence => ({
            ...sentence,
            user_id: user.id
        }));
        const { error: insertError } = await _supabase.from('sentences').insert(sentencesWithUserId);
        if (insertError) throw insertError;
        batchInput.value = '';
        let message = `成功添加 ${sentencesWithUserId.length} 个句子。`;
        if (duplicateCount > 0) message += ` 忽略了 ${duplicateCount} 个重复句子。`;
        showCustomConfirm(message).then(() => {
            fetchAllSentences();
            generateAndUpdateHighFrequencyWords(user);
        });
    } catch (error) {
        console.error('批量添加失败:', error);
        showCustomConfirm(`批量添加失败: ${error.message}`);
    } finally {
        addBatchBtn.classList.remove('loading');
        addBatchBtn.disabled = false;
    }
}
function liveSearch() {
    const searchTerm = sentenceSearch.value.toLowerCase();
    const filtered = allSentences.filter(s =>
        s.spanish_text.toLowerCase().includes(searchTerm) ||
        s.chinese_translation.toLowerCase().includes(searchTerm)
    );
    renderManageSentences(filtered);
}

// === 事件监听器与初始化 ===
window.addEventListener('load', () => {

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            }
        });
    }

    if (isIndexPage) {
        const initialLoad = async () => {
            const { data: { user } } = await _supabase.auth.getUser();
            let lastSentenceId = null;
            if (user) {
                // **【断点续学】修正：移除 .single()，使用更安全的数组检查**
                const { data: profile, error } = await _supabase
                    .from('profiles')
                    .select('last_sentence_id')
                    .eq('id', user.id);
                if (error) {
                    console.error("获取用户 profile 失败:", error);
                } else if (profile && profile.length > 0) {
                    lastSentenceId = profile[0].last_sentence_id;
                }
            }

            await Promise.all([fetchAllSentences(), fetchAndMapWords()]);

            let isJump = false;
            const targetSentenceId = sessionStorage.getItem('targetSentenceId');
            if (targetSentenceId) {
                const targetIndex = allSentences.findIndex(s => s.id == targetSentenceId);
                if (targetIndex !== -1) {
                    currentIndex = targetIndex;
                    isJump = true;
                }
                sessionStorage.removeItem('targetSentenceId');
            } else if (lastSentenceId) {
                const targetIndex = allSentences.findIndex(s => s.id == lastSentenceId);
                if (targetIndex !== -1) {
                    currentIndex = targetIndex;
                    isJump = true;
                    console.log(`已恢复学习进度至句子ID: ${lastSentenceId}`);
                }
            }

            filterAndSortSentences(!isJump);

            const unmasteredSentences = allSentences.filter(s => !s.mastered);
            if (currentStatusFilter === 'unmastered' && unmasteredSentences.length === 0 && allSentences.length > 0) {
                console.log("没有未掌握的句子，切换到“所有”视图。");
                currentStatusFilter = 'all';
                if (statusFilterGroup) {
                    statusFilterGroup.querySelector('[data-value="unmastered"]').classList.remove('active');
                    statusFilterGroup.querySelector('[data-value="all"]').classList.add('active');
                }
                filterAndSortSentences(true);
            }
        };

        initialLoad().catch(error => {
            console.error("初始化数据加载时发生错误:", error);
            if (emptyMessage) {
                emptyMessage.innerText = `加载数据时发生严重错误...\n错误: ${error.message}`;
                emptyMessage.style.color = 'var(--danger-color)';
            }
        });

        if (statusFilterGroup) {
            statusFilterGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    currentStatusFilter = e.target.dataset.value;
                    statusFilterGroup.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    filterAndSortSentences(true);
                }
            });
        }

        if (sortOrderGroup) {
            sortOrderGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    currentSortOrder = e.target.dataset.value;
                    sortOrderGroup.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    filterAndSortSentences(true);
                }
            });
        }

        if (sentenceCard) {
            sentenceCard.addEventListener('click', async (event) => {
                if (isSingleSentenceMode || event.target.closest('button') || event.target.classList.contains('highlight-word') || event.target.closest('.card-footer')) {
                    return;
                }
                const rect = sentenceCard.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                if (event.clientX < midpoint) {
                    currentIndex = (currentIndex > 0) ? currentIndex - 1 : currentFilteredSentences.length - 1;
                } else {
                    currentIndex = (currentIndex < currentFilteredSentences.length - 1) ? currentIndex + 1 : 0;
                }
                renderSentenceCard();

                const currentSentence = currentFilteredSentences[currentIndex];
                if (currentSentence) {
                    const { data: { user } } = await _supabase.auth.getUser();
                    if (user) {
                        await _supabase
                            .from('profiles')
                            .update({ last_sentence_id: currentSentence.id, updated_at: new Date() })
                            .eq('id', user.id);
                    }
                    readTextWithSupabase(currentSentence.spanish_text, false, null);
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

        if (masteredToggle) {
            masteredToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentFilteredSentences.length > 0) {
                    const currentSentence = currentFilteredSentences[currentIndex];
                    toggleMastered(currentSentence.id, !currentSentence.mastered);
                }
            });
        }
        if (addSentenceLink) addSentenceLink.addEventListener('click', (e) => { e.stopPropagation(); addSentenceModal.style.display = 'flex'; });
        if (editSentenceLink) editSentenceLink.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(); });
        if (deleteSentenceLink) deleteSentenceLink.addEventListener('click', (e) => { e.stopPropagation(); deleteCurrentSentence(); });
        if (addSentenceForm) addSentenceForm.addEventListener('submit', handleAddSentence);
        if (editSentenceForm) editSentenceForm.addEventListener('submit', handleEditSentence);
        if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => addSentenceModal.style.display = 'none');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => editSentenceModal.style.display = 'none');

    } else if (isManagePage) {
        fetchAllSentences();
        if (addBatchBtn) addBatchBtn.addEventListener('click', addSentences);
        if (sentenceSearch) sentenceSearch.addEventListener('input', liveSearch);

    } else if (isVocabularyPage) {
        const initialVocabLoad = async () => {
            const { data: { user } } = await _supabase.auth.getUser();
            let lastWordId = null;
            if(user){
                // **【单词断点续学】修正：移除 .single()，使用更安全的数组检查**
                const { data: profile, error } = await _supabase
                    .from('profiles')
                    .select('last_word_id')
                    .eq('id', user.id);
                if (error) {
                    console.error("获取用户 profile 失败:", error);
                } else if (profile && profile.length > 0) {
                    lastWordId = profile[0].last_word_id;
                }
            }

            await Promise.all([fetchHighFrequencyWords(), fetchAllSentences()]);
            
            filterAndSortWords();

             if (lastWordId) {
                const targetIndex = currentFilteredWords.findIndex(w => w.id === lastWordId);
                 if (targetIndex !== -1) {
                    currentWordIndex = targetIndex;
                    renderWordCard();
                    console.log(`已恢复单词学习进度至: ${currentFilteredWords[currentWordIndex].spanish_word}`);
                }
             }
        };

        initialVocabLoad().catch(error => {
            console.error("词汇页数据加载时发生错误:", error);
            if (emptyVocabularyMessage) {
                emptyVocabularyMessage.innerText = `加载数据时发生严重错误...\n错误: ${error.message}`;
                emptyVocabularyMessage.style.color = 'var(--danger-color)';
            }
        });

        if (wordStatusFilterGroup) {
            wordStatusFilterGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    currentWordStatusFilter = e.target.dataset.value;
                    wordStatusFilterGroup.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    filterAndSortWords();
                }
            });
        }

        if (wordSortOrderGroup) {
            wordSortOrderGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    currentWordSortOrder = e.target.dataset.value;
                    wordSortOrderGroup.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    filterAndSortWords();
                }
            });
        }

        if (wordCard) {
            wordCard.addEventListener('click', async (event) => {
                if (event.target.closest('button') || event.target.closest('.card-footer') || event.target.id === 'word-frequency-badge') {
                    return;
                }
                const rect = wordCard.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                if (event.clientX < midpoint) {
                    currentWordIndex = (currentWordIndex > 0) ? currentWordIndex - 1 : currentFilteredWords.length - 1;
                } else {
                    currentWordIndex = (currentWordIndex < currentFilteredWords.length - 1) ? currentWordIndex + 1 : 0;
                }
                renderWordCard();

                const currentWord = currentFilteredWords[currentWordIndex];
                if (currentWord) {
                    const { data: { user } } = await _supabase.auth.getUser();
                    if(user){
                         await _supabase
                            .from('profiles')
                            .update({ last_word_id: currentWord.id, updated_at: new Date() })
                            .eq('id', user.id);
                    }
                    readTextWithSupabase(currentWord.spanish_word, false, wordReadBtn);
                }
            });
        }
        
        if (wordMasteredToggle) {
            wordMasteredToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentFilteredWords.length > 0) {
                    const currentWord = currentFilteredWords[currentWordIndex];
                    toggleWordMastered(currentWord.id, !currentWord.mastered);
                }
            });
        }
        
        if(sentenceListCloseBtn) {
            sentenceListCloseBtn.addEventListener('click', () => {
                sentenceListModal.style.display = 'none';
            });
        }
    }
});