// js/quiz-main.js (带有超详细调试日志的版本)

import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { readText, initializeDropdowns } from './utils.js';

// --- State Management & DOM Elements (保持不变) ---
let currentUser = null;
let allSentences = [];
let allWords = [];
let quizQuestions = [];
let wrongAnswers = [];
let currentQuestionIndex = 0;
const dom = {
    setupView: document.getElementById('quiz-setup'),
    quizView: document.getElementById('quiz-view'),
    resultsView: document.getElementById('results-view'),
    setupForm: document.getElementById('quiz-setup-form'),
    contentTypeSelector: document.getElementById('content-type-selector'),
    scopeSelection: document.getElementById('scope-selection'),
    startQuizBtn: document.getElementById('start-quiz-btn'),
    questionProgress: document.getElementById('question-progress'),
    replayAudioBtn: document.getElementById('replay-audio-btn'),
    questionContent: document.getElementById('question-content'),
    feedbackContainer: document.getElementById('feedback-container'),
    nextQuestionBtn: document.getElementById('next-question-btn'),
    scoreText: document.getElementById('score-text'),
    wrongAnswersList: document.getElementById('wrong-answers-list'),
    retestWrongBtn: document.getElementById('retest-wrong-btn'),
};

// --- Core Logic ---

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
    
    // 【调试】打印出用于统计的源数据
    console.log(`[DEBUG] 1. 源数据 (sourceData) for "${contentType}":`, JSON.parse(JSON.stringify(sourceData)));


    if (sourceData.length === 0) {
        dom.scopeSelection.innerHTML = `<p class="muted-text">您还没有添加任何${contentType === 'sentences' ? '句子' : '单词'}，请先去学习页面添加。</p>`;
        return;
    }
    
    const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('item_id, is_correct')
        .eq('user_id', currentUser.id)
        .eq('item_type', contentType)
        .order('attempted_at', { ascending: true });

    if (error) {
        console.error('Error fetching quiz attempts', error);
        dom.scopeSelection.innerHTML = `<p class="error-text">加载统计失败，请检查控制台错误。</p>`;
        return;
    }

    // 【调试】打印出从数据库获取的原始答题记录
    console.log('[DEBUG] 2. 从数据库获取的原始答题记录 (attempts):', JSON.parse(JSON.stringify(attempts)));

    const testedIds = new Map();
    attempts.forEach(attempt => {
        const key = String(attempt.item_id);
        testedIds.set(key, attempt.is_correct);
        // 【调试】打印正在存入Map的每一个键
        console.log(`[DEBUG] 3. 正在存入Map: key='${key}' (type: ${typeof key}), value=${attempt.is_correct}`);
    });

    const stats = { untested: [], correct: [], incorrect: [] };

    sourceData.forEach(item => {
        const keyToCheck = String(item.id);
        const hasBeenTested = testedIds.has(keyToCheck);
        // 【调试】打印正在检查的每一个键，以及检查结果
        console.log(`[DEBUG] 4. 正在检查 item.id='${keyToCheck}' (type: ${typeof keyToCheck})... 是否在Map中? -> ${hasBeenTested}`);

        if (!hasBeenTested) {
            stats.untested.push(item);
        } else if (testedIds.get(keyToCheck)) {
            stats.correct.push(item);
        } else {
            stats.incorrect.push(item);
        }
    });

    console.log('[DEBUG] 5. 最终统计结果:', stats);

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
        .select('item_id, is_correct')
        .eq('user_id', currentUser.id)
        .eq('item_type', contentType)
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
    wrongAnswers = [];
    dom.setupView.style.display = 'none';
    dom.resultsView.style.display = 'none';
    dom.quizView.style.display = 'block';
    
    displayQuestion();
}

function displayQuestion() {
    dom.feedbackContainer.innerHTML = '';
    dom.nextQuestionBtn.style.display = 'none';
    
    if (currentQuestionIndex >= quizQuestions.length) {
        showResults();
        return;
    }

    dom.questionProgress.textContent = `问题 ${currentQuestionIndex + 1} / ${quizQuestions.length}`;
    const question = quizQuestions[currentQuestionIndex];
    const contentType = dom.contentTypeSelector.querySelector('.active').dataset.type;

    if (contentType === 'sentences') {
        displaySentenceQuestion(question);
    } else {
        displayWordQuestion(question);
    }
}

function displaySentenceQuestion(question) {
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

    readText(question.spanish_text);
    dom.replayAudioBtn.onclick = () => readText(question.spanish_text);

    dom.questionContent.querySelectorAll('.mcq-btn').forEach(btn => {
        btn.addEventListener('click', () => checkSentenceAnswer(btn.textContent === question.chinese_translation, question));
    });
}

function displayWordQuestion(question) {
    const contentHtml = `
        <div class="dictation-group">
            <input type="text" id="dictation-input" class="form-input" placeholder="请在此输入听到的单词..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <div id="special-chars" class="special-chars">
                <button>á</button><button>é</button><button>í</button><button>ó</button><button>ú</button><button>ñ</button><button>ü</button>
            </div>
            <button id="check-dictation-btn" class="btn btn-primary">检查答案</button>
        </div>
    `;
    dom.questionContent.innerHTML = contentHtml;

    const input = document.getElementById('dictation-input');
    
    readText(question.spanish_word);
    dom.replayAudioBtn.onclick = () => readText(question.spanish_word);

    document.getElementById('special-chars').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value += btn.textContent;
            input.focus();
        });
    });

    document.getElementById('check-dictation-btn').addEventListener('click', () => {
        const userAnswer = input.value.trim();
        checkWordAnswer(userAnswer, question);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('check-dictation-btn').click();
        }
    });
    
    input.focus();
}

function checkSentenceAnswer(isCorrect, question) {
    document.querySelectorAll('.mcq-btn').forEach(btn => btn.disabled = true);
    
    if (isCorrect) {
        dom.feedbackContainer.innerHTML = `<div class="feedback correct">回答正确！</div>`;
    } else {
        dom.feedbackContainer.innerHTML = `<div class="feedback incorrect">回答错误！正确答案是：<br><strong>${question.chinese_translation}</strong></div>`;
        wrongAnswers.push(question);
    }

    logAttempt(question.id, isCorrect, 'sentence');
    dom.nextQuestionBtn.style.display = 'inline-flex';
}

function checkWordAnswer(userAnswer, question) {
    const correctAnswer = question.spanish_word;
    let isCorrect = false;
    let feedbackHtml = '';

    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        isCorrect = true;
        feedbackHtml = `<div class="feedback correct">回答正确！</div>`;
        if (userAnswer !== correctAnswer) {
            feedbackHtml += `<p class="feedback-note">请注意大小写：<strong>${correctAnswer}</strong></p>`;
        }
    } else if (userAnswer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === correctAnswer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) {
        isCorrect = true; // Lenient mode
        feedbackHtml = `<div class="feedback correct">回答正确！</div>`;
        feedbackHtml += `<p class="feedback-note">请注意重音符号：<strong>${correctAnswer}</strong></p>`;
    } else {
        isCorrect = false;
        feedbackHtml = `<div class="feedback incorrect">回答错误！正确答案是：<br><strong>${correctAnswer}</strong></div>`;
        wrongAnswers.push(question);
    }

    dom.feedbackContainer.innerHTML = feedbackHtml;
    logAttempt(question.id, isCorrect, 'word');
    dom.nextQuestionBtn.style.display = 'inline-flex';
    document.getElementById('check-dictation-btn').disabled = true;
}

async function logAttempt(itemId, isCorrect, itemType) {
    await supabase.from('quiz_attempts').insert({
        user_id: currentUser.id,
        item_id: itemId,
        item_type: itemType,
        is_correct: isCorrect
    });
}

function nextQuestion() {
    currentQuestionIndex++;
    displayQuestion();
}

function showResults() {
    dom.quizView.style.display = 'none';
    dom.resultsView.style.display = 'block';

    const score = quizQuestions.length - wrongAnswers.length;
    dom.scoreText.textContent = `您答对了 ${score} / ${quizQuestions.length} 题！`;

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
        dom.wrongAnswersList.innerHTML = '<p>太棒了，全部正确！</p>';
        dom.retestWrongBtn.style.display = 'none';
    }
}

function setupEventListeners() {
    dom.contentTypeSelector.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
            dom.contentTypeSelector.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            loadStats();
        }
    });

    dom.setupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        generateQuizQuestions();
    });

    dom.nextQuestionBtn.addEventListener('click', nextQuestion);

    dom.retestWrongBtn.addEventListener('click', () => {
        quizQuestions = [...wrongAnswers];
        startQuiz();
    });
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