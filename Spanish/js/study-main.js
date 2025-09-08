import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { showCustomConfirm, readText, generateAndUpdateHighFrequencyWords, initializeDropdowns } from './utils.js';

// --- 1. State Management ---
let currentUser = null;
let currentStudyMode = 'sentences';
let allSentences = [], currentFilteredSentences = [], sentenceIndex = 0, sentenceStatusFilter = 'unmastered', sentenceSortOrder = 'sequential';
let allWords = [], currentFilteredWords = [], wordIndex = 0, wordStatusFilter = 'unmastered', wordSortOrder = 'frequency';
let wordTranslationMap = new Map();

// --- 为单词列表无限滚动添加状态 ---
const WORDS_PER_PAGE = 30;
let wordListPage = 1;
let isLoadingMoreWords = false;


// --- 2. DOM Elements ---
const dom = {
    filterMenuBtn: document.getElementById('filter-menu-btn'),
    filterPanel: document.getElementById('filter-panel'),
    studyModeSwitcher: document.getElementById('study-mode-switcher'),
    switcherPill: document.getElementById('switcher-pill'),
    sentenceFilters: document.getElementById('sentence-filters'),
    wordFilters: document.getElementById('word-filters'),
    emptyMessage: document.getElementById('empty-message'),
    sentenceCardContainer: document.getElementById('sentence-card-container'),
    sentenceCard: document.getElementById('sentence-card'),
    sentenceSpanishText: document.querySelector('#sentence-card .spanish'),
    sentenceChineseText: document.querySelector('#sentence-card .chinese'),
    masteredToggle: document.getElementById('mastered-toggle'),
    sentenceReadBtn: document.getElementById('index-read-btn'),
    sentenceSlowReadBtn: document.getElementById('index-slow-read-btn'),
    sentenceWordReadBtn: document.getElementById('index-word-read-btn'),
    sentenceAiExplainBtn: document.getElementById('index-ai-explain-btn'),
    addSentenceLink: document.getElementById('add-sentence-link'),
    editSentenceLink: document.getElementById('edit-sentence-link'),
    deleteSentenceLink: document.getElementById('delete-sentence-link'),
    wordCardContainer: document.getElementById('word-card-container'),
    wordListContainer: null, 
    aiExplanationModal: document.getElementById('aiExplanationModal'),
    aiExplanationTitle: document.getElementById('aiExplanationTitle'),
    aiExplanationContent: document.getElementById('aiExplanationContent'),
    aiExplanationCloseBtn: document.getElementById('aiExplanationCloseBtn'),
    aiWordExplanationModal: document.getElementById('aiWordExplanationModal'),
    aiWordExplanationTitle: document.getElementById('aiWordExplanationTitle'),
    aiWordExplanationContent: document.getElementById('aiWordExplanationContent'),
    aiWordExplanationCloseBtn: document.getElementById('aiWordExplanationCloseBtn'),
    addSentenceModal: document.getElementById('addSentenceModal'),
    addSentenceForm: document.getElementById('add-sentence-form'),
    editSentenceModal: document.getElementById('editSentenceModal'),
    editSentenceForm: document.getElementById('edit-sentence-form'),
    sentenceListModal: document.getElementById('sentenceListModal'),
    sentenceListTitle: document.getElementById('sentenceListTitle'),
    sentenceListContent: document.getElementById('sentence-list-content'),
    sentenceListCloseBtn: document.getElementById('sentenceListCloseBtn'),
    sentenceStatusFilterGroup: document.getElementById('status-filter-group'),
    sentenceSortOrderGroup: document.getElementById('sort-order-group'),
    wordStatusFilterGroup: document.getElementById('word-status-filter-group'),
    wordSortOrderGroup: document.getElementById('word-sort-order-group'),
};


async function logStudyEvent(itemId, itemType) {
    if (!currentUser || !itemId || !itemType) return;
    console.log(`Logging study event: user=${currentUser.id}, item=${itemId}, type=${itemType}`); // 用于调试
    const { error } = await supabase.from('study_log').upsert({ user_id: currentUser.id, item_id: itemId, item_type: itemType, }, { onConflict: 'user_id, item_id, item_type' });
    if (error) { console.error('Error logging study event:', error); }
}

async function fetchInitialData() {
    dom.emptyMessage.textContent = '加载中...';
    const sentencePromise = supabase.from('sentences').select('*').eq('user_id', currentUser.id).order('id', { ascending: true });
    const wordPromise = supabase.from('high_frequency_words').select('*').eq('user_id', currentUser.id);
    const wordMapPromise = supabase.from('high_frequency_words').select('spanish_word, chinese_translation').eq('user_id', currentUser.id);
    const [{ data: sentencesData, error: sentencesError }, { data: wordsData, error: wordsError }, { data: wordMapData, error: wordMapError }] = await Promise.all([sentencePromise, wordPromise, wordMapPromise]);
    if (sentencesError || wordsError || wordMapError) {
        console.error('Data fetching error:', sentencesError || wordsError || wordMapError);
        dom.emptyMessage.textContent = '数据加载失败。';
        return false;
    }
    allSentences = sentencesData || [];
    allWords = wordsData || [];
    wordTranslationMap.clear();
    (wordMapData || []).forEach(word => {
        if (word.chinese_translation) {
            wordTranslationMap.set(word.spanish_word, word.chinese_translation)
        }
    });
    return true;
}

function updatePillPosition() {
    const activeButton = dom.studyModeSwitcher.querySelector('button.active');
    if (activeButton && dom.switcherPill) {
        dom.switcherPill.style.width = `${activeButton.offsetWidth}px`;
        dom.switcherPill.style.transform = `translateX(${activeButton.offsetLeft - 4}px)`;
    }
}

function renderUI() {
    const isSentenceMode = currentStudyMode === 'sentences';
    dom.sentenceFilters.style.display = isSentenceMode ? 'flex' : 'none';
    dom.wordFilters.style.display = isSentenceMode ? 'none' : 'flex';

    if (isSentenceMode) {
        dom.wordCardContainer.style.display = 'none';
        renderSentenceCard();
    } else {
        dom.sentenceCardContainer.style.display = 'none';
        renderWordList();
    }
}

function renderSentenceCard() {
    filterAndSortSentences();
    if (currentFilteredSentences.length === 0) {
        dom.sentenceCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (sentenceStatusFilter === 'mastered') dom.emptyMessage.textContent = '您还没有掌握任何句子！';
        else if (sentenceStatusFilter === 'unmastered' && allSentences.length > 0) dom.emptyMessage.textContent = '恭喜！所有句子都已掌握。';
        else dom.emptyMessage.textContent = '您的句子列表为空，请在“管理”页面添加新句子。';
        return;
    }
    dom.emptyMessage.style.display = 'none';
    dom.sentenceCardContainer.style.display = 'flex';
    const currentSentence = currentFilteredSentences[sentenceIndex];
    const sentenceText = currentSentence.spanish_text;
    const tokens = sentenceText.split(/([,;!?."\s¿¡—:-])/);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    const htmlParts = tokens.map(token => {
        const cleanToken = token.toLowerCase().replace(punctuationRegex, '').trim();
        if (wordTranslationMap.has(cleanToken)) {
            const translation = wordTranslationMap.get(cleanToken);
            return `<span class="highlight-word" data-word="${cleanToken}" title="${translation}">${token}</span>`;
        }
        return `<span>${token}</span>`;
    });
    dom.sentenceSpanishText.innerHTML = htmlParts.join('');
    dom.sentenceChineseText.textContent = currentSentence.chinese_translation;
    dom.masteredToggle.classList.toggle('mastered', currentSentence.mastered);
}

// --- 修改：渲染单词列表的函数，增加标题和备注 ---
function renderWordList(loadMore = false) {
    if (!loadMore) {
        wordListPage = 1;
        filterAndSortWords();
        dom.wordListContainer.innerHTML = ''; // 清空列表
        // 【新增】在这里添加标题和备注
        if (currentFilteredWords.length > 0) {
            const headerHTML = `
                <h2 class="word-list-title">单词列表</h2>
                <p class="word-list-note">点击发音图标以外的地方进入单词学习。</p>
            `;
            dom.wordListContainer.innerHTML = headerHTML;
        }
    }

    if (currentFilteredWords.length === 0) {
        dom.wordCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (wordStatusFilter === 'mastered') dom.emptyMessage.textContent = '您还没有掌握任何词汇！';
        else if (wordStatusFilter === 'unmastered' && allWords.length > 0) dom.emptyMessage.textContent = '恭喜！所有词汇都已掌握。';
        else dom.emptyMessage.textContent = '暂无高频词汇，请先添加一些句子。';
        return;
    }

    dom.emptyMessage.style.display = 'none';
    dom.wordCardContainer.style.display = 'block';

    const startIndex = (wordListPage - 1) * WORDS_PER_PAGE;
    const endIndex = startIndex + WORDS_PER_PAGE;
    const wordsToRender = currentFilteredWords.slice(startIndex, endIndex);

    if (wordsToRender.length === 0 && !loadMore) {
        dom.emptyMessage.style.display = 'flex';
        dom.wordCardContainer.style.display = 'none';
        return; // 【新增】确保没有词时，标题和备注也不显示
    }

    const fragment = document.createDocumentFragment();
    wordsToRender.forEach(word => {
        const item = document.createElement('div');
        item.className = 'word-list-item';
        item.dataset.wordId = word.id;

        item.innerHTML = `
            <div class="mastered-toggle-word ${word.mastered ? 'mastered' : ''}" title="标记已掌握">
                <svg class="mastered-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.79"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <span class="word-text">${word.spanish_word}</span>
            <div class="actions">
                <button class="icon-btn-list read-btn" title="朗读">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <button class="icon-btn-list slow-read-btn" title="慢速朗读">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </button>
            </div>
        `;
        fragment.appendChild(item);
    });

    dom.wordListContainer.appendChild(fragment);
    isLoadingMoreWords = false;
    wordListPage++;
}


function filterAndSortSentences() {
    let filtered = allSentences;
    if (sentenceStatusFilter === 'unmastered') filtered = allSentences.filter(s => !s.mastered);
    else if (sentenceStatusFilter === 'mastered') filtered = allSentences.filter(s => s.mastered);
    if (sentenceSortOrder === 'random') currentFilteredSentences = [...filtered].sort(() => Math.random() - 0.5);
    else currentFilteredSentences = filtered;
    if (sentenceIndex >= currentFilteredSentences.length) sentenceIndex = 0;
}

function filterAndSortWords() {
    let filtered = allWords;
    if (wordStatusFilter === 'unmastered') filtered = allWords.filter(w => !w.mastered);
    else if (wordStatusFilter === 'mastered') filtered = allWords.filter(w => w.mastered);
    if (wordSortOrder === 'random') currentFilteredWords = [...filtered].sort(() => Math.random() - 0.5);
    else currentFilteredWords = [...filtered].sort((a, b) => b.frequency - a.frequency);
    wordIndex = 0;
}

async function toggleSentenceMastered() {
    if (currentFilteredSentences.length === 0) return;
    const sentence = currentFilteredSentences[sentenceIndex];
    const newStatus = !sentence.mastered;
    const { error } = await supabase.from('sentences').update({ mastered: newStatus }).eq('id', sentence.id).eq('user_id', currentUser.id);
    if (error) {
        console.error('更新句子掌握状态失败:', error);
        await showCustomConfirm("状态更新失败！");
    } else {
        sentence.mastered = newStatus;
        renderSentenceCard();
    }
}

async function toggleWordMastered(wordId, buttonElement) {
    const word = allWords.find(w => w.id === wordId);
    if (!word) return;
    
    const newStatus = !word.mastered;
    const { error } = await supabase.from('high_frequency_words').update({ mastered: newStatus }).eq('id', wordId).eq('user_id', currentUser.id);

    if (error) {
        console.error('更新单词掌握状态失败:', error);
        await showCustomConfirm('更新掌握状态失败。');
    } else {
        word.mastered = newStatus;
        buttonElement.classList.toggle('mastered', newStatus);
        
        if (wordStatusFilter === 'unmastered' && newStatus) {
            buttonElement.parentElement.style.display = 'none';
        }
         if (wordStatusFilter === 'mastered' && !newStatus) {
            buttonElement.parentElement.style.display = 'none';
        }
    }
}


async function deleteCurrentSentence() {
    if (currentFilteredSentences.length === 0) return;
    const sentence = currentFilteredSentences[sentenceIndex];
    const confirmation = await showCustomConfirm(`确定要删除这个句子吗？\n"${sentence.spanish_text}"`);
    if (confirmation) {
        const { error } = await supabase.from('sentences').delete().eq('id', sentence.id).eq('user_id', currentUser.id);
        if (error) { await showCustomConfirm('删除失败，请检查网络或刷新页面。'); } else {
            await showCustomConfirm('删除成功！', false);
            setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
            await fetchInitialData();
            await generateAndUpdateHighFrequencyWords(currentUser.id);
            sentenceIndex = 0;
            renderUI();
        }
    }
}

function resetAddSentenceModal() {
    const addSentenceModal = document.getElementById('addSentenceModal');
    addSentenceModal.querySelector('#add-sentence-title').textContent = '新增句子';
    addSentenceModal.querySelector('form').reset();
    document.getElementById('add-chinese-group').style.display = 'none';
    document.getElementById('new-chinese-text').value = '';
    document.getElementById('add-sentence-submit-btn').textContent = '获取翻译';
    document.getElementById('add-sentence-submit-btn').disabled = false;
    document.getElementById('add-sentence-error').textContent = '';
    addSentenceModal.querySelector('form').dataset.state = 'input';
}

async function handleAddSentence(e) {
    e.preventDefault();
    const form = e.target;
    const state = form.dataset.state || 'input';
    const spanishText = document.getElementById('new-spanish-text').value.trim();
    const errorEl = document.getElementById('add-sentence-error');
    const submitBtn = document.getElementById('add-sentence-submit-btn');
    if (state === 'input') {
        if (!spanishText) { errorEl.textContent = '请输入西班牙语句子。'; return; }
        submitBtn.disabled = true;
        submitBtn.textContent = '翻译中...';
        errorEl.textContent = '';
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("用户未认证");
            const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ sentences: [{ spanish_text: spanishText }], getTranslation: true }) });
            if (!response.ok) throw new Error(`AI翻译服务出错: ${await response.text()}`);
            const { translatedSentences } = await response.json();
            if (translatedSentences && translatedSentences.length > 0) {
                document.getElementById('new-chinese-text').value = translatedSentences[0].chinese_translation;
                document.getElementById('add-chinese-group').style.display = 'block';
                submitBtn.textContent = '确认保存';
                form.dataset.state = 'confirm';
            } else { throw new Error('AI未能返回翻译。'); }
        } catch (error) {
            console.error('获取翻译失败:', error);
            errorEl.textContent = `翻译失败: ${error.message}`;
            submitBtn.textContent = '获取翻译';
        } finally {
            submitBtn.disabled = false;
        }
    } else if (state === 'confirm') {
        const chineseText = document.getElementById('new-chinese-text').value.trim();
        if (!chineseText) { errorEl.textContent = '中文翻译不能为空。'; return; }
        submitBtn.disabled = true;
        submitBtn.textContent = '保存中...';
        const { error } = await supabase.from('sentences').insert([{ spanish_text: spanishText, chinese_translation: chineseText, user_id: currentUser.id }]);
        if (error) {
            errorEl.textContent = `保存失败: ${error.message}`;
            submitBtn.disabled = false;
            submitBtn.textContent = '确认保存';
        } else {
            document.getElementById('addSentenceModal').style.display = 'none';
            await showCustomConfirm('添加成功！', false);
            setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
            await fetchInitialData();
            await generateAndUpdateHighFrequencyWords(currentUser.id);
            sentenceIndex = allSentences.findIndex(s => s.spanish_text === spanishText);
            if (sentenceIndex === -1) sentenceIndex = 0;
            renderUI();
        }
    }
}

function openEditSentenceModal() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToEdit = currentFilteredSentences[sentenceIndex];
    dom.editSentenceForm.querySelector('#edit-sentence-id').value = sentenceToEdit.id;
    dom.editSentenceForm.querySelector('#edit-spanish-text').value = sentenceToEdit.spanish_text;
    dom.editSentenceForm.querySelector('#edit-chinese-text').value = sentenceToEdit.chinese_translation;
    dom.editSentenceModal.style.display = 'flex';
}

async function handleEditSentence(e) {
    e.preventDefault();
    const id = dom.editSentenceForm.querySelector('#edit-sentence-id').value;
    const spanishText = dom.editSentenceForm.querySelector('#edit-spanish-text').value.trim();
    const chineseText = dom.editSentenceForm.querySelector('#edit-chinese-text').value.trim();
    if (!spanishText || !chineseText) { await showCustomConfirm('西班牙语和中文翻译均不能为空！'); return; }
    const { error } = await supabase.from('sentences').update({ spanish_text: spanishText, chinese_translation: chineseText, ai_notes: null }).eq('id', id).eq('user_id', currentUser.id);
    if (error) { await showCustomConfirm(`更新失败: ${error.message}`); } else {
        dom.editSentenceModal.style.display = 'none';
        await showCustomConfirm('更新成功！', false);
        setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
        await fetchInitialData();
        await generateAndUpdateHighFrequencyWords(currentUser.id);
        renderUI();
    }
}

async function getAiSentenceExplanation() {
    if (currentFilteredSentences.length === 0) return;
    const currentSentence = currentFilteredSentences[sentenceIndex];
    dom.aiExplanationTitle.textContent = `“${currentSentence.spanish_text}”`;
    dom.aiExplanationModal.style.display = 'flex';
    if (currentSentence.ai_notes) {
        dom.aiExplanationContent.innerHTML = `<p>${currentSentence.ai_notes.replace(/\n/g, '<br>')}</p>`;
        return;
    }
    dom.aiExplanationContent.innerHTML = `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成解释，请稍候...</p>`;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未认证");
        const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ sentence: currentSentence.spanish_text, getExplanation: true }) });
        if (!response.ok) throw new Error(`AI 服务错误 (${response.status}): ${await response.text()}`);
        const result = await response.json();
        const explanation = result.explanation || '未能获取 AI 解释。';
        await supabase.from('sentences').update({ ai_notes: explanation }).eq('id', currentSentence.id);
        currentSentence.ai_notes = explanation;
        dom.aiExplanationContent.innerHTML = `<p>${explanation.replace(/\n/g, '<br>')}</p>`;
    } catch (error) {
        console.error('获取 AI 解释失败:', error);
        dom.aiExplanationContent.innerHTML = `<p>无法连接到 AI 服务。错误详情: ${error.message}</p>`;
    }
}

async function readSentenceWordByWord() {
    const sentence = currentFilteredSentences[sentenceIndex]?.spanish_text;
    if (!sentence) return;
    const words = sentence.split(/\s+/).filter(word => word.length > 0);
    dom.sentenceWordReadBtn.classList.add('playing');
    try {
        for (const word of words) {
            await readText(word);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    } finally {
        dom.sentenceWordReadBtn.classList.remove('playing');
    }
}

async function getAiWordExplanation(word) {
    if (!word) return;

    dom.aiWordExplanationTitle.textContent = `“${word.spanish_word}”`;
    dom.aiWordExplanationModal.style.display = 'flex';

    if (word.ai_explanation && Object.keys(word.ai_explanation).length > 0) {
        renderAiWordExplanation(word.ai_explanation, word.spanish_word);
        return;
    }

    dom.aiWordExplanationContent.innerHTML = `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成深度解析，请稍候...</p>`;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未认证");
        const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ word: word.spanish_word, getExplanation: true })
        });

        if (!response.ok) throw new Error(`AI 服务错误 (${response.status}): ${await response.text()}`);
        
        const data = await response.json();
        const { error: updateError } = await supabase.from('high_frequency_words').update({ ai_explanation: data }).eq('id', word.id);
        
        if (updateError) {
            console.error('Failed to cache AI word explanation:', updateError);
        } else {
            word.ai_explanation = data;
        }
        renderAiWordExplanation(data, word.spanish_word);

    } catch (error) {
        console.error('获取 AI 单词解析失败:', error);
        dom.aiWordExplanationContent.innerHTML = `<p>无法连接到 AI 服务。错误详情: ${error.message}</p>`;
    }
}

function renderAiWordExplanation(data, wordText) {
    let html = '';
    if (data.ipa) {
        html += `<div class="ai-section">
            <div class="ai-section-title">发音</div>
            <div class="ipa-container">
                <span class="ipa-text">${data.ipa}</span>
                <div class="ipa-actions">
                    <button class="icon-btn-modal read-btn" title="朗读">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    </button>
                    <button class="icon-btn-modal slow-read-btn" title="慢速朗读">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </button>
                </div>
            </div>
            ${data.pronunciationTip ? `<p class="pronunciation-tip">${data.pronunciationTip}</p>` : ''}
        </div>`;
    }
    html += `<div class="ai-section"><div class="ai-section-title">核心信息</div><p><strong>词性:</strong> ${data.partOfSpeech || 'N/A'}</p>${data.gender ? `<p><strong>阴阳性:</strong> ${data.gender}</p>` : ''}<p><strong>核心含义:</strong> ${data.coreMeaning || 'N/A'}</p></div>`;
    if (data.usageNotes) {
        html += `<div class="ai-section"><div class="ai-section-title">用法与搭配</div><p>${data.usageNotes.replace(/\n/g, '<br>')}</p></div>`;
    }
    if (data.conjugationTable && data.conjugationTable.forms && data.conjugationTable.forms.length > 0) {
        html += `<div class="ai-section"><div class="ai-section-title">${data.conjugationTable.tense || '动词变位'}</div><ul class="conjugation-table">${data.conjugationTable.forms.map(form => `<li>${form}</li>`).join('')}</ul></div>`;
    }
    if (data.mnemonic) {
        html += `<div class="ai-section"><div class="ai-section-title">联想记忆</div><p>${data.mnemonic.replace(/\n/g, '<br>')}</p></div>`;
    }
    if ((data.synonyms && data.synonyms.length > 0) || (data.antonyms && data.antonyms.length > 0)) {
        html += `<div class="ai-section"><div class="ai-section-title">相关词汇</div>`;
        if (data.synonyms && data.synonyms.length > 0) {
            html += `<p><strong>近义词:</strong> ${data.synonyms.join(', ')}</p>`;
        }
        if (data.antonyms && data.antonyms.length > 0) {
            html += `<p><strong>反义词:</strong> ${data.antonyms.join(', ')}</p>`;
        }
        html += `</div>`;
    }
    
    dom.aiWordExplanationContent.innerHTML = html;
    
    const modalReadBtn = dom.aiWordExplanationContent.querySelector('.read-btn');
    const modalSlowReadBtn = dom.aiWordExplanationContent.querySelector('.slow-read-btn');
    if (modalReadBtn) modalReadBtn.onclick = () => readText(wordText, false, modalReadBtn);
    if (modalSlowReadBtn) modalSlowReadBtn.onclick = () => readText(wordText, true, modalSlowReadBtn);
}


function setupEventListeners() {
    if (dom.filterMenuBtn) dom.filterMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); dom.filterPanel.classList.toggle('is-visible'); });
    document.addEventListener('click', (e) => { if (dom.filterPanel && dom.filterPanel.classList.contains('is-visible') && !dom.filterMenuBtn.contains(e.target) && !dom.filterPanel.contains(e.target)) { dom.filterPanel.classList.remove('is-visible'); } });
    if (dom.studyModeSwitcher) dom.studyModeSwitcher.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' || e.target.classList.contains('active')) return; currentStudyMode = e.target.dataset.mode; supabase.from('profiles').update({ last_study_mode: currentStudyMode }).eq('id', currentUser.id).then(); const activeButton = dom.studyModeSwitcher.querySelector(`[data-mode="${currentStudyMode}"]`); if (activeButton && !activeButton.classList.contains('active')) { dom.studyModeSwitcher.querySelector('.active')?.classList.remove('active'); activeButton.classList.add('active'); } updatePillPosition(); renderUI(); });
    
    if (dom.sentenceStatusFilterGroup) dom.sentenceStatusFilterGroup.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') return; sentenceStatusFilter = e.target.dataset.value; dom.sentenceStatusFilterGroup.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); renderSentenceCard(); });
    if (dom.sentenceSortOrderGroup) dom.sentenceSortOrderGroup.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') return; sentenceSortOrder = e.target.dataset.value; dom.sentenceSortOrderGroup.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); renderSentenceCard(); });
    if (dom.wordStatusFilterGroup) dom.wordStatusFilterGroup.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') return; wordStatusFilter = e.target.dataset.value; dom.wordStatusFilterGroup.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); renderWordList(); });
    if (dom.wordSortOrderGroup) dom.wordSortOrderGroup.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') return; wordSortOrder = e.target.dataset.value; dom.wordSortOrderGroup.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); renderWordList(); });

    if (dom.sentenceCard) dom.sentenceCard.addEventListener('click', (e) => { if (e.target.closest('.card-actions, .card-footer, .highlight-word')) return; const rect = dom.sentenceCard.getBoundingClientRect(); if (currentFilteredSentences.length > 0) { logStudyEvent(currentFilteredSentences[sentenceIndex].id, 'sentence'); } const oldIndex = sentenceIndex; sentenceIndex = e.clientX < (rect.left + rect.width / 2) ? (sentenceIndex > 0 ? sentenceIndex - 1 : currentFilteredSentences.length - 1) : (sentenceIndex < currentFilteredSentences.length - 1 ? sentenceIndex + 1 : 0); if (oldIndex !== sentenceIndex) { renderSentenceCard(); const currentSentence = currentFilteredSentences[sentenceIndex]; if (currentSentence) { supabase.from('profiles').update({ last_sentence_id: currentSentence.id, updated_at: new Date() }).eq('id', currentUser.id).then(); } } });

    // --- 修改：为高亮单词的点击事件绑定新功能，并记录学习事件 ---
    if (dom.sentenceSpanishText) dom.sentenceSpanishText.addEventListener('click', (event) => {
        if (event.target.classList.contains('highlight-word')) {
            event.stopPropagation();
            const wordText = event.target.dataset.word;
            const wordObject = allWords.find(w => w.spanish_word === wordText);
            if (wordObject) {
                // 【新增】记录学习事件
                logStudyEvent(wordObject.id, 'word');
                getAiWordExplanation(wordObject);
            } else {
                showCustomConfirm(`“${wordText}” 不在您的高频词库中。`);
            }
        }
    });

    if (dom.wordListContainer) {
        dom.wordListContainer.addEventListener('click', (e) => {
            const target = e.target;
            const listItem = target.closest('.word-list-item');
            if (!listItem) return;

            const wordId = parseInt(listItem.dataset.wordId, 10);
            const word = allWords.find(w => w.id === wordId);
            if (!word) return;
            
            supabase.from('profiles').update({ last_word_id: word.id, updated_at: new Date() }).eq('id', currentUser.id).then();

            if (target.closest('.mastered-toggle-word')) {
                toggleWordMastered(wordId, target.closest('.mastered-toggle-word'));
            } else if (target.closest('.read-btn')) {
                readText(word.spanish_word, false, target.closest('.read-btn'));
            } else if (target.closest('.slow-read-btn')) {
                readText(word.spanish_word, true, target.closest('.slow-read-btn'));
            } else if (target.closest('.word-text')) {
                // 【新增】记录学习事件
                logStudyEvent(word.id, 'word');
                getAiWordExplanation(word);
            }
        });

        dom.wordListContainer.addEventListener('scroll', () => {
            if (isLoadingMoreWords) return;
            const { scrollTop, scrollHeight, clientHeight } = dom.wordListContainer;
            if (scrollHeight - scrollTop - clientHeight < 200) {
                isLoadingMoreWords = true;
                const totalRendered = (wordListPage - 1) * WORDS_PER_PAGE;
                if (totalRendered < currentFilteredWords.length) {
                    renderWordList(true);
                }
            }
        });
    }

    if (dom.addSentenceLink) dom.addSentenceLink.addEventListener('click', () => { resetAddSentenceModal(); dom.addSentenceModal.style.display = 'flex'; });
    if (dom.editSentenceLink) dom.editSentenceLink.addEventListener('click', openEditSentenceModal);
    if (dom.deleteSentenceLink) dom.deleteSentenceLink.addEventListener('click', deleteCurrentSentence);
    if (dom.masteredToggle) dom.masteredToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleSentenceMastered(); });
    
    if (dom.sentenceReadBtn) dom.sentenceReadBtn.addEventListener('click', () => readText(currentFilteredSentences[sentenceIndex]?.spanish_text, false, dom.sentenceReadBtn));
    if (dom.sentenceSlowReadBtn) dom.sentenceSlowReadBtn.addEventListener('click', () => readText(currentFilteredSentences[sentenceIndex]?.spanish_text, true, dom.sentenceSlowReadBtn));
    if (dom.sentenceWordReadBtn) dom.sentenceWordReadBtn.addEventListener('click', readSentenceWordByWord);
    if (dom.sentenceAiExplainBtn) dom.sentenceAiExplainBtn.addEventListener('click', getAiSentenceExplanation);
    
    if (dom.addSentenceForm) dom.addSentenceForm.addEventListener('submit', handleAddSentence);
    if (dom.addSentenceForm) dom.addSentenceForm.querySelector('#cancel-add-btn').addEventListener('click', () => dom.addSentenceModal.style.display = 'none');
    if (dom.editSentenceForm) dom.editSentenceForm.addEventListener('submit', handleEditSentence);
    if (dom.editSentenceForm) dom.editSentenceForm.querySelector('#cancel-edit-btn').addEventListener('click', () => dom.editSentenceModal.style.display = 'none');
    if (dom.aiExplanationCloseBtn) dom.aiExplanationCloseBtn.addEventListener('click', () => dom.aiExplanationModal.style.display = 'none');
    if (dom.aiWordExplanationCloseBtn) dom.aiWordExplanationCloseBtn.addEventListener('click', () => dom.aiWordExplanationModal.style.display = 'none');
    if (dom.sentenceListCloseBtn) dom.sentenceListCloseBtn.addEventListener('click', () => dom.sentenceListModal.style.display = 'none');
}

function initializeWordListContainer() {
    const oldCard = document.getElementById('word-card');
    const oldFooter = dom.wordCardContainer.querySelector('.card-footer');
    if (oldCard) oldCard.style.display = 'none';
    if (oldFooter) oldFooter.style.display = 'none';
    
    let container = document.getElementById('word-list-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'word-list-container';
        dom.wordCardContainer.prepend(container);
    }
    dom.wordListContainer = container;
}


async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    
    await initializeHeader(currentUser);
    initializeDropdowns();
    initializeWordListContainer();

    const success = await fetchInitialData();
    if (success) {
        const { data: profile } = await supabase.from('profiles').select('last_sentence_id, last_word_id, last_study_mode').eq('id', currentUser.id).single();
        if (profile) {
            if (profile.last_study_mode === 'words') { currentStudyMode = 'words'; }
            if (profile.last_sentence_id) { const lastSentenceIndex = allSentences.findIndex(s => s.id === profile.last_sentence_id); if (lastSentenceIndex !== -1) sentenceIndex = lastSentenceIndex; }
            if (profile.last_word_id) { const lastWordIndex = allWords.findIndex(w => w.id === profile.last_word_id); if (lastWordIndex !== -1) wordIndex = lastWordIndex; }
        }
        const targetSentenceId = sessionStorage.getItem('targetSentenceId');
        if (targetSentenceId) {
            const targetIndex = allSentences.findIndex(s => s.id == targetSentenceId);
            if (targetIndex !== -1) { sentenceIndex = targetIndex; currentStudyMode = 'sentences'; }
            sessionStorage.removeItem('targetSentenceId');
        }
        const activeButton = dom.studyModeSwitcher.querySelector(`[data-mode="${currentStudyMode}"]`);
        if (activeButton && !activeButton.classList.contains('active')) {
            dom.studyModeSwitcher.querySelector('.active')?.classList.remove('active');
            activeButton.classList.add('active');
        }
        setupEventListeners();
        renderUI();
        updatePillPosition();
    }
}

initializePage();