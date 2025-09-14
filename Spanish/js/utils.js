// js/utils.js

import { supabase } from './config.js';

const audio = new Audio();
let isAudioContextUnlocked = false; // 状态变量，用于跟踪音频上下文是否已解锁
let isGlobalClickListenerAdded = false;

// 新增：导出此函数，以便在 study-main.js 中调用
export function unlockAudioContext() {
    if (isAudioContextUnlocked) return;
    const silentSoundSrc = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAAgAAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    const silentAudio = new Audio(silentSoundSrc);
    const playPromise = silentAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isAudioContextUnlocked = true;
            console.log("Audio context unlocked successfully.");
        }).catch(error => {
            console.warn("Audio unlock attempt failed, but context is likely unlocked now.", error);
            isAudioContextUnlocked = true; 
        });
    } else {
        isAudioContextUnlocked = true;
    }
}

export function showCustomConfirm(message, showButtons = true) {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirmModal');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        if (!confirmModal || !confirmMessage || !confirmBtn || !cancelBtn) return resolve(false);

        confirmMessage.innerText = message;
        confirmModal.style.display = 'flex';
        confirmBtn.style.display = showButtons ? 'inline-flex' : 'none';
        cancelBtn.style.display = showButtons ? 'inline-flex' : 'none';

        const closeModal = (resolutionValue) => {
            confirmModal.style.display = 'none';
            confirmModal.removeEventListener('click', clickOutsideHandler);
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
            resolve(resolutionValue);
        };

        const confirmHandler = () => closeModal(true);
        const cancelHandler = () => closeModal(false);
        
        const clickOutsideHandler = (event) => {
            if (event.target === confirmModal) {
                closeModal(!showButtons); 
            }
        };

        if (!showButtons) {
            confirmModal.addEventListener('click', clickOutsideHandler);
        } else {
            confirmBtn.addEventListener('click', confirmHandler);
            cancelBtn.addEventListener('click', cancelHandler);
        }
    });
}

export async function readText(text, isSlow = false, button = null) {
    // 【修改】针对 Safari 的核心修复：同步解锁音频
    // 在任何 await 异步操作之前，立即响应用户的点击事件，播放一段无声音频以获取播放许可。
    const silentSoundSrc = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAAgAAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    
    // 只有在音频暂停时才需要“解锁”
    if (audio.paused) {
        audio.src = silentSoundSrc;
        audio.play().catch(() => {
            // 忽略这里的任何错误，目的只是为了触发用户手势
        });
    }
    // --- 同步解锁结束 ---

    if (!text) return;
    const TTS_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/tts';

    // 停止当前可能正在播放的任何音频
    if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
    }

    document.querySelectorAll('.icon-btn.playing, .highlight-word.playing').forEach(btn => btn.classList.remove('playing'));
    if (button) button.classList.add('playing');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未登录或会话已过期，请重新登录。");
        
        const response = await fetch(TTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ text, isSlow }),
        });
        
        if (!response.ok) throw new Error(`TTS API 错误 (${response.status}): ${await response.text()}`);
        
        const data = await response.json();
        audio.src = `data:audio/mp3;base64,${data.audioContent}`;
        
        await new Promise((resolve, reject) => {
            audio.onended = () => { if (button) button.classList.remove('playing'); resolve(); };
            audio.onerror = (e) => { if (button) button.classList.remove('playing'); reject(new Error("音频播放时发生错误。")); console.error(e); };
            audio.play().catch(playError => { if (button) button.classList.remove('playing'); reject(playError); });
        });
    } catch (error) {
        console.error('从 Supabase TTS 获取音频失败或播放失败:', error);
        if (button) button.classList.remove('playing');
        await showCustomConfirm(`音频服务错误: ${error.message}`);
    }
}

export function getWordsFromSentence(sentence) {
    const stopWords = new Set(['a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas', 'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha', 'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les', 'que', 'quien', 'cuyo', 'donde', 'como', 'cuando', 'cual']);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    return sentence.toLowerCase().replace(punctuationRegex, '').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
}

export async function generateAndUpdateHighFrequencyWords(userId) {
     if (!userId) { console.error("生成高频词失败: 用户ID缺失。"); return; }
    const { data: allSentencesData } = await supabase.from('sentences').select('spanish_text').eq('user_id', userId);
    const { data: existingWordsInDb } = await supabase.from('high_frequency_words').select('spanish_word, chinese_translation').eq('user_id', userId);
    const existingWordMap = new Map((existingWordsInDb || []).map(w => [w.spanish_word, w.chinese_translation]));
    const wordCounts = {};
    const wordSourceSentences = {};
    (allSentencesData || []).forEach(s => {
        const words = getWordsFromSentence(s.spanish_text);
        words.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
            if (!wordSourceSentences[word]) wordSourceSentences[word] = s.spanish_text;
        });
    });
    const newWordsToTranslate = Object.keys(wordCounts).filter(word => !existingWordMap.get(word));
    if (newWordsToTranslate.length > 0) {
        console.log(`发现 ${newWordsToTranslate.length} 个新词，正在调用 AI 进行翻译...`);
        try {
            const TRANSLATE_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence`;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("用户未认证");
            const response = await fetch(TRANSLATE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ words: newWordsToTranslate, getTranslation: true })
            });
            if (!response.ok) throw new Error(`单词翻译API错误: ${await response.text()}`);
            const { translations } = await response.json();
            for (const word in translations) { if (Object.prototype.hasOwnProperty.call(translations, word)) { existingWordMap.set(word, translations[word]); } }
        } catch (error) {
            console.error("调用AI翻译单词失败:", error);
        }
    }
    const wordsToUpsert = Object.keys(wordCounts).map(word => ({ user_id: userId, spanish_word: word, frequency: wordCounts[word], source_sentence: wordSourceSentences[word], chinese_translation: existingWordMap.get(word) || null }));
    if (wordsToUpsert.length > 0) {
        const { error: upsertError } = await supabase.from('high_frequency_words').upsert(wordsToUpsert, { onConflict: 'user_id, spanish_word' });
        if (upsertError) console.error('Supabase 词汇更新错误:', upsertError);
    }
}

export function initializeDropdowns() {
    const dropdownContainers = document.querySelectorAll('.dropdown-container');
    dropdownContainers.forEach(container => {
        const button = container.querySelector('button');
        const menu = container.querySelector('.dropdown-menu');
        if (!button || !menu) return;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            document.querySelectorAll('.dropdown-menu.is-visible').forEach(openMenu => { if (openMenu !== menu) { openMenu.classList.remove('is-visible'); } });
            menu.classList.toggle('is-visible');
        });
    });
    if (!isGlobalClickListenerAdded) {
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu.is-visible').forEach(openMenu => { openMenu.classList.remove('is-visible'); });
        });
        isGlobalClickListenerAdded = true;
    }
}

// 【新增】处理单句增、删、改并精确同步单词库的全局函数
export async function syncWordBankForSentenceChange({ oldSentenceText = '', newSentenceText = '' }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 使用 getWordsFromSentence (已包含停用词逻辑) 来分析新旧单词
    const oldWords = new Set(getWordsFromSentence(oldSentenceText));
    const newWords = new Set(getWordsFromSentence(newSentenceText));

    // 2. 计算差异
    const removedWords = [...oldWords].filter(word => !newWords.has(word));
    const addedWords = [...newWords].filter(word => !oldWords.has(word));

    // 3. 处理被删除的单词
    if (removedWords.length > 0) {
        // 从数据库获取这些单词的当前词频
        const { data: wordsData, error: fetchError } = await supabase
            .from('high_frequency_words')
            .select('spanish_word, frequency')
            .in('spanish_word', removedWords)
            .eq('user_id', user.id);

        if (fetchError) {
            console.error('获取待删除单词的词频失败:', fetchError);
        } else {
            const wordsToDelete = [];
            const wordsToDecrement = [];

            wordsData.forEach(word => {
                if (word.frequency <= 1) {
                    wordsToDelete.push(word.spanish_word);
                } else {
                    wordsToDecrement.push({ 
                        user_id: user.id, 
                        spanish_word: word.spanish_word, 
                        frequency: word.frequency - 1 
                    });
                }
            });

            // 批量删除词频为1的单词
            if (wordsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('high_frequency_words')
                    .delete()
                    .in('spanish_word', wordsToDelete)
                    .eq('user_id', user.id);
                if (deleteError) console.error('删除单词失败:', deleteError);
            }

            // 批量更新（减少）词频
            if (wordsToDecrement.length > 0) {
                const { error: upsertError } = await supabase
                    .from('high_frequency_words')
                    .upsert(wordsToDecrement, { onConflict: 'user_id, spanish_word' });
                if (upsertError) console.error('减少单词词频失败:', upsertError);
            }
        }
    }

    // 4. 处理被新增的单词
    if (addedWords.length > 0) {
        const { data: existingWords, error: fetchExistingError } = await supabase
            .from('high_frequency_words')
            .select('spanish_word, frequency')
            .in('spanish_word', addedWords)
            .eq('user_id', user.id);
        
        if (fetchExistingError) {
            console.error('获取待新增单词失败:', fetchExistingError);
            return;
        }

        const existingWordMap = new Map(existingWords.map(w => [w.spanish_word, w.frequency]));
        const wordsToUpsert = [];
        const brandNewWordsToTranslate = [];

        addedWords.forEach(word => {
            if (existingWordMap.has(word)) {
                // 单词已存在，词频+1
                wordsToUpsert.push({
                    user_id: user.id,
                    spanish_word: word,
                    frequency: existingWordMap.get(word) + 1
                });
            } else {
                // 是一个全新的单词
                brandNewWordsToTranslate.push(word);
            }
        });

        // 为全新的单词获取翻译
        if (brandNewWordsToTranslate.length > 0) {
            try {
                const TRANSLATE_URL = `https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence`;
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("用户未认证");

                const response = await fetch(TRANSLATE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify({ words: brandNewWordsToTranslate, getTranslation: true })
                });

                if (!response.ok) throw new Error(`单词翻译API错误: ${await response.text()}`);
                
                const { translations } = await response.json();
                for (const word in translations) {
                    if (Object.prototype.hasOwnProperty.call(translations, word)) {
                        wordsToUpsert.push({
                            user_id: user.id,
                            spanish_word: word,
                            frequency: 1, // 新单词词频为1
                            chinese_translation: translations[word]
                        });
                    }
                }
            } catch (error) {
                console.error("调用AI翻译新单词失败:", error);
            }
        }

        // 批量更新（增加）和插入新单词
        if (wordsToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('high_frequency_words')
                .upsert(wordsToUpsert, { onConflict: 'user_id, spanish_word' });
            if (upsertError) console.error('增加单词词频或插入新单词失败:', upsertError);
        }
    }
}