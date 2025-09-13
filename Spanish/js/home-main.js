import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { initializeDropdowns } from './utils.js';

let currentUser = null;

const dom = {
    welcomeMessage: document.getElementById('welcome-message'),
    sentenceStudiedProgress: document.getElementById('sentence-studied-progress'),
    sentenceStudiedText: document.getElementById('sentence-studied-text'),
    sentenceMasteredProgress: document.getElementById('sentence-mastered-progress'),
    sentenceMasteredText: document.getElementById('sentence-mastered-text'),
    wordStudiedProgress: document.getElementById('word-studied-progress'),
    wordStudiedText: document.getElementById('word-studied-text'),
    wordMasteredProgress: document.getElementById('word-mastered-progress'),
    wordMasteredText: document.getElementById('word-mastered-text'),
    sessionForm: document.getElementById('session-form'),
    sessionCountInput: document.getElementById('session-count'),
    unmasteredInfo: document.getElementById('unmastered-info'),
    startSessionBtn: document.getElementById('start-session-btn'),
};

async function loadStats() {
    try {
        const { count: totalSentences, error: tsError } = await supabase.from('sentences').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        const { count: masteredSentences, error: msError } = await supabase.from('sentences').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('mastered', true);
        const { count: studiedSentences, error: slError } = await supabase.from('study_log').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('item_type', 'sentence');
        const { count: totalWords, error: twError } = await supabase.from('high_frequency_words').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        const { count: masteredWords, error: mwError } = await supabase.from('high_frequency_words').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('mastered', true);
        const { count: studiedWords, error: wlError } = await supabase.from('study_log').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('item_type', 'word');
        const anyError = tsError || msError || slError || twError || mwError || wlError;
        if (anyError) {
            console.error('Failed to load stats:', anyError);
            return;
        }
        dom.sentenceStudiedText.textContent = `${studiedSentences || 0} / ${totalSentences || 0}`;
        dom.sentenceStudiedProgress.style.width = totalSentences > 0 ? `${((studiedSentences || 0) / totalSentences) * 100}%` : '0%';
        dom.sentenceMasteredText.textContent = `${masteredSentences || 0} / ${totalSentences || 0}`;
        dom.sentenceMasteredProgress.style.width = totalSentences > 0 ? `${((masteredSentences || 0) / totalSentences) * 100}%` : '0%';
        const unmasteredCount = (totalSentences || 0) - (masteredSentences || 0);
        dom.unmasteredInfo.textContent = `共有 ${unmasteredCount} 个未掌握的句子可供学习。`;
        dom.sessionCountInput.max = unmasteredCount;
        if (unmasteredCount === 0) {
            dom.startSessionBtn.disabled = true;
            dom.startSessionBtn.querySelector('span').textContent = '已全部掌握！';
        }
        dom.wordStudiedText.textContent = `${studiedWords || 0} / ${totalWords || 0}`;
        dom.wordStudiedProgress.style.width = totalWords > 0 ? `${((studiedWords || 0) / totalWords) * 100}%` : '0%';
        dom.wordMasteredText.textContent = `${masteredWords || 0} / ${totalWords || 0}`;
        dom.wordMasteredProgress.style.width = totalWords > 0 ? `${((masteredWords || 0) / totalWords) * 100}%` : '0%';
    } catch (error) {
        console.error("An unexpected error occurred in loadStats:", error);
    }
}


async function startSession(event) {
    event.preventDefault();
    const count = parseInt(dom.sessionCountInput.value, 10);
    if (isNaN(count) || count <= 0) {
        alert('请输入一个有效的学习数量！');
        return;
    }
    dom.startSessionBtn.disabled = true;
    dom.startSessionBtn.querySelector('span').textContent = '正在准备...';
    const { data, error } = await supabase
        .from('sentences')
        .select('id, spanish_text')
        .eq('user_id', currentUser.id)
        .or('mastered.is.null,mastered.eq.false')
        .order('id', { ascending: true }) 
        .limit(count);
    if (error) {
        console.error('Error fetching sentences for session:', error);
        alert('准备学习会话失败！');
        dom.startSessionBtn.disabled = false;
        dom.startSessionBtn.querySelector('span').textContent = '开始学习';
        return;
    }
    if (data.length === 0) {
        alert('没有可供学习的未掌握句子了！');
        dom.startSessionBtn.disabled = false;
        dom.startSessionBtn.querySelector('span').textContent = '开始学习';
        return;
    }
    const sessionData = {
        sentenceIds: data.map(s => s.id),
        sentences: data,
        total: data.length,
        currentIndex: 0
    };
    sessionStorage.setItem('studySession', JSON.stringify(sessionData));
    window.location.href = 'study.html'; // 确认跳转到新的自由学习页
}


async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    sessionStorage.removeItem('studySession');
    sessionStorage.removeItem('quizSession');
    await initializeHeader(currentUser);
    initializeDropdowns();
    const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', currentUser.id).single();
    if(profile && profile.nickname) {
        dom.welcomeMessage.textContent = `欢迎回来, ${profile.nickname}!`;
    }
    await loadStats();
    dom.sessionForm.addEventListener('submit', startSession);
}

initializePage();