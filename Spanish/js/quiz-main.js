// js/quiz-main.js

import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { readText, initializeDropdowns, showCustomConfirm, getWordsFromSentence } from './utils.js';

// --- 1. State Management ---
let currentUser = null;
let allSentences = [];
let allWords = [];
let quizQuestions = [];
let preparedQuizQuestions = [];
let answeredStates = new Map();
let currentQuestionIndex = 0;
let autoAdvanceTimer = null;
let wrongAnswers = [];
let userHasScrolledManually = false;
let allStudiedIds = new Set();
let allTestedIds = new Map();
let isSessionQuiz = false;
let isAutoplayThisSession = false; 

// --- 2. DOM Elements ---
const dom = {
    setupView: document.getElementById('quiz-setup'),
    quizView: document.getElementById('quiz-view'),
    resultsView: document.getElementById('results-view'),
    setupForm: document.getElementById('quiz-setup-form'),
    contentTypeSelector: document.getElementById('content-type-selector'),
    studyScopeSelector: document.getElementById('study-scope-selector'),
    testScopeSelection: document.getElementById('test-scope-selection'),
    startQuizBtn: document.getElementById('start-quiz-btn'),
    questionInstruction: document.getElementById('question-instruction'),
    quizReadBtn: document.getElementById('quiz-read-btn'),
    quizSlowReadBtn: document.getElementById('quiz-slow-read-btn'),
    endQuizBtn: document.getElementById('end-quiz-btn'),
    questionContent: document.getElementById('question-content'),
    feedbackContainer: document.getElementById('feedback-container'),
    progressBarContainer: document.getElementById('progress-bar-container'),
    progressPrevBtn: document.getElementById('progress-prev-btn'),
    progressNextBtn: document.getElementById('progress-next-btn'),
    scoreText: document.getElementById('score-text'),
    wrongAnswersList: document.getElementById('wrong-answers-list'),
    retestWrongBtn: document.getElementById('retest-wrong-btn'),
    newQuizBtn: document.getElementById('new-quiz-btn'),
    quizPageWrapper: document.getElementById('quiz-page-wrapper')
};

// --- 3. Core Logic ---
function showFeedback(question) {
    if (!question || !answeredStates.has(question.id)) {
        dom.feedbackContainer.innerHTML = '';
        return;
    }

    const { isCorrect } = answeredStates.get(question.id);
    const questionType = question.spanish_text ? 'sentences' : 'words';

    if (isCorrect) {
        dom.feedbackContainer.innerHTML = `<div class="feedback correct">回答正确！</div>`;
    } else {
        if (questionType === 'sentences') {
            dom.feedbackContainer.innerHTML = `
                <div class="feedback incorrect">
                    回答错误！
                    <div class="feedback-note">${question.spanish_text}</div>
                </div>
            `;
        } else {
            const correctAnswer = question.spanish_word;
            dom.feedbackContainer.innerHTML = `<div class="feedback incorrect">回答错误！正确答案是：<br><strong>${correctAnswer}</strong></div>`;
        }
    }
}
async function fetchAllData() { const { data: sentences, error: sError } = await supabase.from('sentences').select('*').eq('user_id', currentUser.id); if (sError) console.error('Error fetching sentences', sError); allSentences = sentences || []; const { data: words, error: wError } = await supabase.from('high_frequency_words').select('*').eq('user_id', currentUser.id); if (wError) console.error('Error fetching words', wError); allWords = words || []; }
function updateStatCounts() { const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type; const sourceData = contentType === 'sentences' ? allSentences : allWords; const studyScope = dom.studyScopeSelector.querySelector('.active').dataset.scope; let initialPool = []; if (studyScope === 'all') { initialPool = [...sourceData]; } else if (studyScope === 'studied') { initialPool = sourceData.filter(item => allStudiedIds.has(item.id)); } else { initialPool = sourceData.filter(item => !allStudiedIds.has(item.id)); } const stats = { untested: initialPool.filter(item => !allTestedIds.has(String(item.id))).length, incorrect: initialPool.filter(item => allTestedIds.get(String(item.id)) === false).length, correct: initialPool.filter(item => allTestedIds.get(String(item.id)) === true).length, }; dom.testScopeSelection.querySelector('input[value="untested"]').nextElementSibling.textContent = ` 未测试 (${stats.untested} 条)`; dom.testScopeSelection.querySelector('input[value="incorrect"]').nextElementSibling.textContent = ` 曾在测试中答错 (${stats.incorrect} 条)`; dom.testScopeSelection.querySelector('input[value="correct"]').nextElementSibling.textContent = ` 曾在测试中答对 (${stats.correct} 条)`; }
async function loadStats() {
    dom.testScopeSelection.innerHTML = `<div class="loading-spinner"></div>`;
    const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type;
    const sourceData = contentType === 'sentences' ? allSentences : allWords;
    if (sourceData.length === 0) { dom.testScopeSelection.innerHTML = `<p class="muted-text">您还没有添加任何内容，请先去学习页面添加。</p>`; dom.startQuizBtn.disabled = true; return; }
    const itemType = contentType === 'sentences' ? 'sentence' : 'word';
    const studyLogPromise = supabase.from('study_log').select('item_id', { count: 'exact' }).eq('user_id', currentUser.id).eq('item_type', itemType);
    const attemptsPromise = supabase.from('quiz_attempts').select('item_id, is_correct').eq('user_id', currentUser.id).eq('item_type', itemType);
    const [{ data: studyLogs, error: studyLogError }, { data: attempts, error: attemptsError }] = await Promise.all([studyLogPromise, attemptsPromise]);
    if (studyLogError || attemptsError) { console.error('Error fetching stats:', studyLogError || attemptsError); dom.testScopeSelection.innerHTML = `<p class="error-text">加载统计失败。</p>`; dom.startQuizBtn.disabled = true; return; }
    allStudiedIds = new Set((studyLogs || []).map(log => log.item_id));
    allTestedIds.clear();
    (attempts || []).forEach(attempt => { allTestedIds.set(String(attempt.item_id), attempt.is_correct); });
    const totalStudiedCount = allStudiedIds.size;
    dom.studyScopeSelector.querySelector('[data-scope="all"]').textContent = `全部内容 (${sourceData.length})`;
    dom.studyScopeSelector.querySelector('[data-scope="studied"]').textContent = `已学习的 (${totalStudiedCount})`;
    dom.studyScopeSelector.querySelector('[data-scope="unstudied"]').textContent = `未学习的 (${sourceData.length - totalStudiedCount})`;
    dom.testScopeSelection.innerHTML = ` <label class="scope-option"> <input type="checkbox" name="scope" value="untested" checked> <span class="scope-label-text"></span> </label> <label class="scope-option"> <input type="checkbox" name="scope" value="incorrect"> <span class="scope-label-text"></span> </label> <label class="scope-option"> <input type="checkbox" name="scope" value="correct"> <span class="scope-label-text"></span> </label> `;
    updateStatCounts();
    await prepareQuestionPool();
}
async function prepareQuestionPool() {
    dom.startQuizBtn.disabled = true;
    dom.startQuizBtn.textContent = '正在准备题目...';
    const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type;
    const sourceData = contentType === 'sentences' ? allSentences : allWords;
    const studyScope = dom.studyScopeSelector.querySelector('.active').dataset.scope;
    const testScopes = Array.from(dom.testScopeSelection.querySelectorAll('input[name="scope"]:checked')).map(cb => cb.value);
    let initialPool = [];
    if (studyScope === 'all') { initialPool = [...sourceData]; } else if (studyScope === 'studied') { initialPool = sourceData.filter(item => allStudiedIds.has(item.id)); } else { initialPool = sourceData.filter(item => !allStudiedIds.has(item.id)); }
    if (testScopes.length > 0) {
        let finalPool = new Set();
        initialPool.forEach(item => {
            const itemIdStr = String(item.id);
            const isTested = allTestedIds.has(itemIdStr);
            const isCorrect = isTested ? allTestedIds.get(itemIdStr) : false;
            if (testScopes.includes('untested') && !isTested) finalPool.add(item);
            if (testScopes.includes('incorrect') && isTested && !isCorrect) finalPool.add(item);
            if (testScopes.includes('correct') && isTested && isCorrect) finalPool.add(item);
        });
        preparedQuizQuestions = Array.from(finalPool);
    } else {
        preparedQuizQuestions = initialPool;
    }
    for (let i = preparedQuizQuestions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[preparedQuizQuestions[i], preparedQuizQuestions[j]] = [preparedQuizQuestions[j], preparedQuizQuestions[i]]; }
    if (preparedQuizQuestions.length > 0) { dom.startQuizBtn.disabled = false; dom.startQuizBtn.textContent = '开始测试'; } else { dom.startQuizBtn.textContent = '没有符合条件的题目'; }
}
function startQuiz() {
    quizQuestions = preparedQuizQuestions;
    if (quizQuestions.length === 0) {
        showCustomConfirm('没有符合条件的题目可供测试！');
        return;
    }
    currentQuestionIndex = 0;
    answeredStates.clear();
    userHasScrolledManually = false;
    
    dom.setupView.style.display = 'none';
    dom.resultsView.style.display = 'none';
    dom.quizView.style.display = 'block';

    promptForAutoplay();
}
async function promptForAutoplay() {
    const message = '音频将自动播放，请确保您当前的环境适合收听。';
    const confirmText = '好的，自动播放';
    const cancelText = '本次手动播放';

    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    confirmMessage.innerText = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    confirmBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';

    const userChoicePromise = new Promise(resolve => {
        const confirmHandler = () => resolve(true);
        const cancelHandler = () => resolve(false);

        confirmBtn.onclick = confirmHandler;
        cancelBtn.onclick = cancelHandler;
    });
    
    confirmModal.style.display = 'flex';

    const userChoseAutoplay = await userChoicePromise;

    confirmModal.style.display = 'none';
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    confirmBtn.textContent = '确定';
    cancelBtn.textContent = '取消';

    isAutoplayThisSession = userChoseAutoplay;

    renderProgressBar();
    displayQuestion();
}
function displayQuestion() {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    const question = quizQuestions[currentQuestionIndex];
    if (!question) {
        showResults();
        return;
    }
    const isAnswered = answeredStates.has(question.id);
    if (isAnswered) {
        showFeedback(question);
    } else {
        dom.feedbackContainer.innerHTML = '';
    }
    const questionType = question.spanish_text ? 'sentences' : 'words';

    if (questionType === 'sentences') {
        dom.questionInstruction.textContent = '请点击“朗读”按钮听句子，然后选择正确的翻译。';
        displaySentenceQuestion(question, isAnswered);
    } else {
        dom.questionInstruction.textContent = '请根据看到的中文，拼写出对应的单词。';
        displayWordQuestion(question, isAnswered);
    }

    const audioText = questionType === 'sentences' ? question.spanish_text : question.spanish_word;
    
    dom.quizReadBtn.onclick = () => readText(audioText, false, dom.quizReadBtn);
    dom.quizSlowReadBtn.onclick = () => readText(audioText, true, dom.quizSlowReadBtn);
    updateProgressBar();
    updateNavButtons();

    if (isAutoplayThisSession && !isAnswered) {
        readText(audioText, false, dom.quizReadBtn);
    }
}
function displaySentenceQuestion(question, isAnswered) { const distractors = allSentences.filter(s => s.id !== question.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(s => s.chinese_translation); const options = [question.chinese_translation, ...distractors].sort(() => 0.5 - Math.random()); let optionsHtml = '<div class="mcq-options">'; options.forEach((option, index) => { const letter = String.fromCharCode(65 + index); optionsHtml += `<button class="btn mcq-btn" data-option="${option}"><span class="mcq-letter">${letter}</span><span class="mcq-text">${option}</span></button>`; }); optionsHtml += '</div>'; dom.questionContent.innerHTML = optionsHtml; if (isAnswered) { const { isCorrect, userAnswer } = answeredStates.get(question.id); document.querySelectorAll('.mcq-btn').forEach(btn => { btn.disabled = true; if (btn.dataset.option === question.chinese_translation) btn.classList.add('correct'); if (btn.dataset.option === userAnswer && !isCorrect) btn.classList.add('incorrect'); }); } else { dom.questionContent.querySelectorAll('.mcq-btn').forEach(btn => { btn.addEventListener('click', (e) => { const clickedButton = e.target.closest('.mcq-btn'); checkSentenceAnswer(clickedButton.dataset.option === question.chinese_translation, question, clickedButton); }); }); } }
function displayWordQuestion(question, isAnswered) { const contentHtml = `<div class="dictation-group"><div class="dictation-word-translation">${question.chinese_translation}</div><input type="text" id="dictation-input" class="form-input" placeholder="请在此输入单词..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><div id="special-chars" class="special-chars"><button>á</button><button>é</button><button>í</button><button>ó</button><button>ú</button><button>ñ</button><button>ü</button></div><button id="check-dictation-btn" class="btn btn-primary">检查答案</button></div>`; dom.questionContent.innerHTML = contentHtml; const input = document.getElementById('dictation-input'); const checkBtn = document.getElementById('check-dictation-btn'); if (isAnswered) { const { userAnswer } = answeredStates.get(question.id); input.value = userAnswer; input.disabled = true; checkBtn.disabled = true; } else { document.getElementById('special-chars').querySelectorAll('button').forEach(btn => { btn.addEventListener('click', () => { input.value += btn.textContent; input.focus(); }); }); checkBtn.addEventListener('click', () => checkWordAnswer(input.value.trim(), question)); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkBtn.click(); }); input.focus(); } }
function checkSentenceAnswer(isCorrect, question, clickedButton) {
    userHasScrolledManually = false;
    
    document.querySelectorAll('.mcq-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.option === question.chinese_translation) {
            btn.classList.add('correct');
        }
    });

    if (!isCorrect) {
        clickedButton.classList.add('incorrect');
    }

    answeredStates.set(question.id, { isCorrect, question, userAnswer: clickedButton.dataset.option });
    showFeedback(question);
    logAttempt(question.id, isCorrect, 'sentence');
    updateProgressBar();
    updateNavButtons();
    if (currentQuestionIndex >= quizQuestions.length - 1) {
        setTimeout(() => {
            handleQuizCompletion();
        }, 2500);
    }
}
function checkWordAnswer(userAnswer, question) {
    userHasScrolledManually = false;
    const correctAnswer = question.spanish_word;
    let isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    answeredStates.set(question.id, { isCorrect, question, userAnswer });
    showFeedback(question);
    logAttempt(question.id, isCorrect, 'word');
    updateProgressBar();
    document.getElementById('check-dictation-btn').disabled = true;
    document.getElementById('dictation-input').disabled = true;
    updateNavButtons();

    if (currentQuestionIndex >= quizQuestions.length - 1) {
        setTimeout(() => {
            handleQuizCompletion();
        }, 2500);
    }
}
async function logAttempt(itemId, isCorrect, itemType) { await supabase.from('quiz_attempts').insert({ user_id: currentUser.id, item_id: itemId, item_type: itemType, is_correct: isCorrect }); }

async function handleQuizCompletion() {
    const confirmation = await showCustomConfirm('您已完成所有题目，要结束测试并查看结果吗？');
    if (confirmation) {
        showResults();
    }
}


function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        animateQuestionChange('next');
    } else {
        handleQuizCompletion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        animateQuestionChange('prev');
    }
}

function animateQuestionChange(changeDirection) {
    const quizCard = dom.quizView;
    if (quizCard.classList.contains('is-animating')) return;
    quizCard.classList.add('is-animating');

    const isNext = changeDirection === 'next';
    const outClass = isNext ? 'animate-slide-out-left' : 'animate-slide-out-right';
    const inClass = isNext ? 'animate-slide-in-right' : 'animate-slide-in-left';

    quizCard.classList.add(outClass);

    quizCard.addEventListener('animationend', () => {
        if (isNext) {
            currentQuestionIndex++;
        } else {
            currentQuestionIndex--;
        }
        displayQuestion();

        quizCard.classList.remove(outClass);
        quizCard.classList.add(inClass);

        quizCard.addEventListener('animationend', () => {
            quizCard.classList.remove(inClass, 'is-animating');
        }, { once: true });
        
    }, { once: true });
}


function updateNavButtons() {
    dom.progressPrevBtn.disabled = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex >= quizQuestions.length - 1;
    dom.progressNextBtn.disabled = isLastQuestion;
}

function showResults() {
    dom.quizView.style.display = 'none';
    dom.resultsView.style.display = 'block';
    
    const answeredCount = answeredStates.size;
    wrongAnswers = Array.from(answeredStates.values()).filter(state => !state.isCorrect).map(state => state.question);
    const correctCount = answeredCount - wrongAnswers.length;
    dom.scoreText.textContent = `您答对了 ${correctCount} / ${answeredCount} 题！`;
    
    if (wrongAnswers.length > 0) {
        let wrongHtml = '<h3>错题回顾：</h3><ul>';
        wrongAnswers.forEach(item => {
            const spanish = item.spanish_text || item.spanish_word;
            const chinese = item.chinese_translation || 'N/A';
            wrongHtml += `<li><strong>${spanish}</strong><br>${chinese}</li>`;
        });
        wrongHtml += '</ul>';
        dom.wrongAnswersList.innerHTML = wrongHtml;
        dom.retestWrongBtn.style.display = 'inline-flex';
    } else {
        dom.wrongAnswersList.innerHTML = answeredCount > 0 ? '<p>太棒了，全部正确！</p>' : '<p>您没有回答任何题目。</p>';
        dom.retestWrongBtn.style.display = 'none';
    }

    if (isSessionQuiz) {
        dom.newQuizBtn.textContent = '返回主页';
    } else {
        dom.newQuizBtn.textContent = '开始新测试';
    }
}
function renderProgressBar() { let dotsHtml = ''; for (let i = 0; i < quizQuestions.length; i++) { dotsHtml += `<div class="progress-dot" data-index="${i}">${i + 1}</div>`; } dom.progressBarContainer.innerHTML = `<div class="progress-bar-track">${dotsHtml}</div>`; const track = dom.progressBarContainer.querySelector('.progress-bar-track'); track.querySelectorAll('.progress-dot').forEach(dot => { dot.addEventListener('click', () => { if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer); userHasScrolledManually = false; currentQuestionIndex = parseInt(dot.dataset.index, 10); displayQuestion(); }); }); }
function updateProgressBar() { const track = dom.progressBarContainer.querySelector('.progress-bar-track'); if (!track) return; track.querySelectorAll('.progress-dot').forEach((dot, index) => { dot.classList.remove('current', 'correct', 'incorrect'); const questionId = quizQuestions[index]?.id; if (questionId) { const state = answeredStates.get(questionId); if (state) { dot.classList.add(state.isCorrect ? 'correct' : 'incorrect'); } } if (index === currentQuestionIndex) { dot.classList.add('current'); } }); if (!userHasScrolledManually) { const currentDot = track.children[currentQuestionIndex]; if (currentDot) { currentDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } } }
async function handleEndQuiz() { if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer); const confirmation = await showCustomConfirm('您确定要结束本次测试吗？'); if (confirmation) { showResults(); } }
function setupEventListeners() {
    dom.contentTypeSelector.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) { dom.contentTypeSelector.querySelector('.active')?.classList.remove('active'); e.target.classList.add('active'); loadStats(); } });
    dom.studyScopeSelector.addEventListener('click', (e) => { const button = e.target.closest('button'); if (button && !button.classList.contains('active')) { dom.studyScopeSelector.querySelector('.active')?.classList.remove('active'); button.classList.add('active'); const allCheckBoxes = dom.testScopeSelection.querySelectorAll('input[name="scope"]'); if (button.dataset.scope === 'unstudied') { allCheckBoxes.forEach(cb => { cb.checked = (cb.value === 'untested'); cb.disabled = true; }); } else { allCheckBoxes.forEach(cb => { cb.disabled = false; }); } updateStatCounts(); prepareQuestionPool(); } });
    dom.testScopeSelection.addEventListener('change', (e) => { if (e.target.name === 'scope') { prepareQuestionPool(); } });
    dom.setupForm.addEventListener('submit', (e) => { e.preventDefault(); startQuiz(); });
    dom.endQuizBtn.addEventListener('click', handleEndQuiz);
    
    dom.retestWrongBtn.addEventListener('click', () => { 
        isSessionQuiz = false;
        preparedQuizQuestions = [...wrongAnswers]; 
        startQuiz(); 
    });

    dom.newQuizBtn.addEventListener('click', () => {
        if (isSessionQuiz) {
            window.location.href = 'index.html';
        } else {
            dom.resultsView.style.display = 'none';
            dom.setupView.style.display = 'block';
            loadStats();
        }
    });

    dom.progressPrevBtn.addEventListener('click', prevQuestion);
    dom.progressNextBtn.addEventListener('click', nextQuestion);
}

function initializeSwipeGestures() {
    const quizView = dom.quizView;
    if (!quizView) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwipeStartedOnInteractiveElement = false;
    const swipeThreshold = 50;

    quizView.addEventListener('touchstart', (event) => {
        const target = event.target;
        
        if (target.closest('button, input, a, .mcq-btn')) {
            isSwipeStartedOnInteractiveElement = true;
            return;
        }
        isSwipeStartedOnInteractiveElement = false;

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }, { passive: true });

    quizView.addEventListener('touchend', (event) => {
        if (isSwipeStartedOnInteractiveElement) {
            return;
        }

        touchEndX = event.changedTouches[0].clientX;
        touchEndY = event.changedTouches[0].clientY;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < 0) {
                if (!dom.progressNextBtn.disabled) {
                    nextQuestion();
                }
            } else {
                if (!dom.progressPrevBtn.disabled) {
                    prevQuestion();
                }
            }
        }
    }
}
// --- 4. Page Initialization ---

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;

    const quizSessionData = sessionStorage.getItem('quizSession');
    
    // 【修改】先设置标志位
    isSessionQuiz = !!quizSessionData;

    await initializeHeader(currentUser);
    initializeDropdowns();
    // 【修改】后绑定事件
    setupEventListeners(); 
    initializeSwipeGestures(); 

    if (quizSessionData) {
        console.log("检测到会话测试任务，进入会话测试模式。");
        sessionStorage.removeItem('quizSession');
        const session = JSON.parse(quizSessionData);

        dom.setupView.style.display = 'none';
        
        await fetchAllData();

        let questions = [];
        const sentenceIds = new Set(session.sentenceIds || []);
        const wordIds = new Set(session.wordIds || []);

        if (session.type === 'sentence') {
            questions = allSentences.filter(s => sentenceIds.has(s.id));
            for (let i = questions.length - 1; i > 0; i--) { 
                const j = Math.floor(Math.random() * (i + 1));
                [questions[i], questions[j]] = [questions[j], questions[i]];
            }
        } else if (session.type === 'word') {
            questions = allWords.filter(w => wordIds.has(w.id));
            for (let i = questions.length - 1; i > 0; i--) { 
                const j = Math.floor(Math.random() * (i + 1));
                [questions[i], questions[j]] = [questions[j], questions[i]];
            }
        } else if (session.type === 'mixed') {
            const orderedQuestions = [];
            const sessionSentences = session.sentenceIds.map(id => allSentences.find(s => s.id === id)).filter(Boolean);
            
            for (const sentence of sessionSentences) {
                orderedQuestions.push(sentence);
                const wordsInSentence = getWordsFromSentence(sentence.spanish_text);
                for (const wordText of wordsInSentence) {
                    const wordObject = allWords.find(w => w.spanish_word === wordText);
                    if (wordObject && wordIds.has(wordObject.id)) {
                        orderedQuestions.push(wordObject);
                    }
                }
            }
            questions = orderedQuestions;
        }
        
        preparedQuizQuestions = questions;
        
        startQuiz();

    } else {
        console.log("未检测到会话测试任务，进入自由测试模式。");
        dom.setupView.style.display = 'block';
        await fetchAllData();
        await loadStats();
    }
    
    document.body.classList.remove('uninitialized');
    dom.quizPageWrapper.style.visibility = 'visible';
    dom.quizPageWrapper.style.opacity = '1';
}

initializePage();
