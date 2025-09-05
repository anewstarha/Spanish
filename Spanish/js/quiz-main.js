import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { readText, initializeDropdowns } from './utils.js';

// --- 1. State Management ---
let currentUser = null;
let allSentences = [];
let allWords = [];
let quizQuestions = [];
let wrongAnswers = [];
let currentQuestionIndex = 0;
let answeredStates = new Map();
let autoAdvanceTimer = null; // 【最终修复】声明计时器变量

// --- 2. DOM Elements ---
const dom = {
    setupView: document.getElementById('quiz-setup'),
    quizView: document.getElementById('quiz-view'),
    resultsView: document.getElementById('results-view'),
    setupForm: document.getElementById('quiz-setup-form'),
    contentTypeSelector: document.getElementById('content-type-selector'),
    scopeSelection: document.getElementById('scope-selection'),
    startQuizBtn: document.getElementById('start-quiz-btn'),
    questionInstruction: document.getElementById('question-instruction'),
    playbackControls: document.getElementById('playback-controls'),
    quizReadBtn: document.getElementById('quiz-read-btn'),
    quizSlowReadBtn: document.getElementById('quiz-slow-read-btn'),
    endQuizBtn: document.getElementById('end-quiz-btn'),
    questionContent: document.getElementById('question-content'),
    feedbackContainer: document.getElementById('feedback-container'),
    progressBarContainer: document.getElementById('progress-bar-container'),
    scoreText: document.getElementById('score-text'),
    wrongAnswersList: document.getElementById('wrong-answers-list'),
    retestWrongBtn: document.getElementById('retest-wrong-btn'),
    newQuizBtn: document.getElementById('new-quiz-btn'),
};

// --- 3. Core Logic ---
async function fetchAllData() {
    const { data: sentences, error: sError } = await supabase.from('sentences').select('*').eq('user_id', currentUser.id);
    if (sError) console.error('Error fetching sentences', sError);
    allSentences = sentences || [];

    const { data: words, error: wError } = await supabase.from('high_frequency_words').select('*').eq('user_id', currentUser.id);
    if (wError) console.error('Error fetching words', wError);
    allWords = words || [];
}

async function loadStats() {
    dom.scopeSelection.innerHTML = `<div class="loading-spinner"></div>`;
    const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type;
    const sourceData = contentType === 'sentences' ? allSentences : allWords;
    
    if (sourceData.length === 0) {
        dom.scopeSelection.innerHTML = `<p class="muted-text">您还没有添加任何${contentType === 'sentences' ? '句子' : '单词'}，请先去学习页面添加。</p>`;
        return;
    }
    
    const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('item_type', contentType === 'sentences' ? 'sentence' : 'word')
        .order('attempted_at', { ascending: true });

    if (error) {
        console.error('Error fetching quiz attempts', error);
        dom.scopeSelection.innerHTML = `<p class="error-text">加载统计失败，请检查控制台错误。</p>`;
        return;
    }

    const testedIds = new Map();
    attempts.forEach(attempt => {
        testedIds.set(String(attempt.item_id), attempt.is_correct);
    });

    const stats = {
        untested: [],
        correct: [],
        incorrect: []
    };

    sourceData.forEach(item => {
        if (!testedIds.has(String(item.id))) {
            stats.untested.push(item);
        } else if (testedIds.get(String(item.id))) {
            stats.correct.push(item);
        } else {
            stats.incorrect.push(item);
        }
    });

    dom.scopeSelection.innerHTML = `
        <label class="scope-option">
            <input type="checkbox" name="scope" value="untested" checked>
            未测试 (${stats.untested.length} 条)
        </label>
        <label class="scope-option">
            <input type="checkbox" name="scope" value="incorrect" checked>
            曾答错 (${stats.incorrect.length} 条)
        </label>
        <label class="scope-option">
            <input type="checkbox" name="scope" value="correct">
            曾答对 (${stats.correct.length} 条)
        </label>
    `;
}

function generateQuizQuestions() {
    const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type;
    const sourceData = contentType === 'sentences' ? allSentences : allWords;
    const selectedScopes = Array.from(dom.setupForm.querySelectorAll('input[name="scope"]:checked')).map(cb => cb.value);

    supabase.from('quiz_attempts')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('item_type', contentType === 'sentences' ? 'sentence' : 'word')
        .order('attempted_at', { ascending: true })
        .then(({ data: attempts }) => {
            const testedIds = new Map();
            (attempts || []).forEach(attempt => {
                testedIds.set(String(attempt.item_id), attempt.is_correct);
            });

            let questionPool = [];
            if (selectedScopes.includes('untested')) {
                questionPool.push(...sourceData.filter(item => !testedIds.has(String(item.id))));
            }
            if (selectedScopes.includes('incorrect')) {
                questionPool.push(...sourceData.filter(item => testedIds.get(String(item.id)) === false));
            }
            if (selectedScopes.includes('correct')) {
                questionPool.push(...sourceData.filter(item => testedIds.get(String(item.id)) === true));
            }
            
            for (let i = questionPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questionPool[i], questionPool[j]] = [questionPool[j], questionPool[i]];
            }

            quizQuestions = questionPool;
            startQuiz();
        });
}

function startQuiz() {
    if (quizQuestions.length === 0) {
        alert('没有符合条件的题目可供测试！');
        return;
    }
    
    currentQuestionIndex = 0;
    answeredStates.clear();
    dom.setupView.style.display = 'none';
    dom.resultsView.style.display = 'none';
    dom.quizView.style.display = 'block';
    
    renderProgressBar();
    displayQuestion(true);
}

function displayQuestion(shouldAutoplay = false) {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    
    dom.feedbackContainer.innerHTML = '';
    
    if (currentQuestionIndex >= quizQuestions.length) {
        showResults();
        return;
    }

    const question = quizQuestions[currentQuestionIndex];
    const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type;
    const isAnswered = answeredStates.has(question.id);

    if (contentType === 'sentences') {
        dom.questionInstruction.textContent = '请根据听到的句子，选择正确的中文翻译。';
        displaySentenceQuestion(question, isAnswered);
    } else {
        dom.questionInstruction.textContent = '请根据听到的读音和看到的中文，拼写出对应的单词。';
        displayWordQuestion(question, isAnswered);
    }

    const audioText = contentType === 'sentences' ? question.spanish_text : question.spanish_word;
    if (shouldAutoplay && !isAnswered) {
        readText(audioText);
    }
    dom.quizReadBtn.onclick = () => readText(audioText, false, dom.quizReadBtn);
    dom.quizSlowReadBtn.onclick = () => readText(audioText, true, dom.quizSlowReadBtn);

    updateProgressBar();
}

function displaySentenceQuestion(question, isAnswered) {
    const distractors = allSentences
        .filter(s => s.id !== question.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(s => s.chinese_translation);
    
    const options = [question.chinese_translation, ...distractors].sort(() => 0.5 - Math.random());

    let optionsHtml = '<div class="mcq-options">';
    options.forEach(option => {
        optionsHtml += `<button class="btn mcq-btn">${option}</button>`;
    });
    optionsHtml += '</div>';
    dom.questionContent.innerHTML = optionsHtml;

    if (isAnswered) {
        const { isCorrect, userAnswer } = answeredStates.get(question.id);
        document.querySelectorAll('.mcq-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === question.chinese_translation) btn.classList.add('correct');
            if (btn.textContent === userAnswer && !isCorrect) btn.classList.add('incorrect');
        });
    } else {
        dom.questionContent.querySelectorAll('.mcq-btn').forEach(btn => {
            btn.addEventListener('click', (e) => checkSentenceAnswer(btn.textContent === question.chinese_translation, question, e.target));
        });
    }
}

function displayWordQuestion(question, isAnswered) {
    const contentHtml = `
        <div class="dictation-group">
            <div class="dictation-word-translation">${question.chinese_translation}</div>
            <input type="text" id="dictation-input" class="form-input" placeholder="请在此输入听到的单词..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <div id="special-chars" class="special-chars">
                <button>á</button><button>é</button><button>í</button><button>ó</button><button>ú</button><button>ñ</button><button>ü</button>
            </div>
            <button id="check-dictation-btn" class="btn btn-primary">检查答案</button>
        </div>
    `;
    dom.questionContent.innerHTML = contentHtml;

    const input = document.getElementById('dictation-input');
    const checkBtn = document.getElementById('check-dictation-btn');

    if (isAnswered) {
        const { userAnswer } = answeredStates.get(question.id);
        input.value = userAnswer;
        input.disabled = true;
        checkBtn.disabled = true;
    } else {
        document.getElementById('special-chars').querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value += btn.textContent;
                input.focus();
            });
        });
        checkBtn.addEventListener('click', () => checkWordAnswer(input.value.trim(), question));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkBtn.click(); });
        input.focus();
    }
}

function checkSentenceAnswer(isCorrect, question, clickedButton) {
    document.querySelectorAll('.mcq-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === question.chinese_translation) btn.classList.add('correct');
    });
    
    if (isCorrect) {
        dom.feedbackContainer.innerHTML = `<div class="feedback correct">回答正确！</div>`;
    } else {
        clickedButton.classList.add('incorrect');
        dom.feedbackContainer.innerHTML = `<div class="feedback incorrect">回答错误！</div>`;
    }
    
    answeredStates.set(question.id, { isCorrect, question, userAnswer: clickedButton.textContent });
    logAttempt(question.id, isCorrect, 'sentence');
    updateProgressBar();
    autoAdvanceTimer = setTimeout(nextQuestion, 2000);
}

function checkWordAnswer(userAnswer, question) {
    const correctAnswer = question.spanish_word;
    let isCorrect = false;
    let feedbackHtml = '';

    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        isCorrect = true;
        feedbackHtml = `<div class="feedback correct">回答正确！</div>`;
        if (userAnswer !== correctAnswer) feedbackHtml += `<p class="feedback-note">请注意大小写：<strong>${correctAnswer}</strong></p>`;
    } else if (userAnswer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === correctAnswer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) {
        isCorrect = true;
        feedbackHtml = `<div class="feedback correct">回答正确！</div>`;
        feedbackHtml += `<p class="feedback-note">请注意重音符号：<strong>${correctAnswer}</strong></p>`;
    } else {
        isCorrect = false;
        feedbackHtml = `<div class="feedback incorrect">回答错误！正确答案是：<br><strong>${correctAnswer}</strong></div>`;
    }

    dom.feedbackContainer.innerHTML = feedbackHtml;
    answeredStates.set(question.id, { isCorrect, question, userAnswer });
    logAttempt(question.id, isCorrect, 'word');
    updateProgressBar();
    document.getElementById('check-dictation-btn').disabled = true;
    document.getElementById('dictation-input').disabled = true;
    autoAdvanceTimer = setTimeout(nextQuestion, 3000);
}

async function logAttempt(itemId, isCorrect, itemType) {
    if (answeredStates.has(itemId)) { 
        // Logic to update existing attempt could go here, but for now we insert new ones
    }
    await supabase.from('quiz_attempts').insert({
        user_id: currentUser.id,
        item_id: itemId,
        item_type: itemType,
        is_correct: isCorrect
    });
}

function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion(true);
    } else {
        showResults();
    }
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
}

function renderProgressBar() {
    let dotsHtml = '';
    for (let i = 0; i < quizQuestions.length; i++) {
        dotsHtml += `<div class="progress-dot" data-index="${i}"></div>`;
    }
    dom.progressBarContainer.innerHTML = `<div class="progress-bar-track">${dotsHtml}</div>`;
    
    const track = dom.progressBarContainer.querySelector('.progress-bar-track');
    track.querySelectorAll('.progress-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            currentQuestionIndex = parseInt(dot.dataset.index, 10);
            displayQuestion();
        });
    });
}

function updateProgressBar() {
    const track = dom.progressBarContainer.querySelector('.progress-bar-track');
    if (!track) return;
    
    track.querySelectorAll('.progress-dot').forEach((dot, index) => {
        dot.classList.remove('current', 'correct', 'incorrect');
        const questionId = quizQuestions[index].id;
        const state = answeredStates.get(questionId);
        if (state) {
            dot.classList.add(state.isCorrect ? 'correct' : 'incorrect');
        }
        if (index === currentQuestionIndex) {
            dot.classList.add('current');
        }
    });

    const currentDot = track.children[currentQuestionIndex];
    if (currentDot) {
        const containerWidth = dom.progressBarContainer.offsetWidth;
        const dotOffset = currentDot.offsetLeft + (currentDot.offsetWidth / 2);
        let scrollPosition = dotOffset - (containerWidth / 2);
        
        if (scrollPosition < 0) scrollPosition = 0;
        
        dom.progressBarContainer.scrollTo({
            left: scrollPosition,
            behavior: 'smooth'
        });
    }
}

function setupEventListeners() {
    if (dom.contentTypeSelector) {
        dom.contentTypeSelector.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
                dom.contentTypeSelector.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                loadStats();
            }
        });
    }
    
    if (dom.setupForm) {
        dom.setupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            generateQuizQuestions();
        });
    }
    
    if (dom.endQuizBtn) dom.endQuizBtn.addEventListener('click', showResults);
    
    if (dom.retestWrongBtn) {
        dom.retestWrongBtn.addEventListener('click', () => {
            quizQuestions = [...wrongAnswers];
            startQuiz();
        });
    }
    
    if (dom.newQuizBtn) {
        dom.newQuizBtn.addEventListener('click', () => {
            dom.resultsView.style.display = 'none';
            dom.setupView.style.display = 'block';
            loadStats(); 
        });
    }
}

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;

    await initializeHeader(currentUser);
    initializeDropdowns();
    setupEventListeners();

    await fetchAllData();
    await loadStats();
}

initializePage();