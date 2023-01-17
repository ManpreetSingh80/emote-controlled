'use strict';

import Papa from 'papaparse';
import {readFileSync, writeFileSync} from 'fs';
import tokenize from './tokenizer.js';

const EMOTES_PATH = 'lexica/emote_distribution.tsv';
const EMOJIS_PATH = 'lexica/emoji_distribution.tsv';
const VADER_PATH = 'lexica/vader_distribution.tsv';
const lexica = {};
let emotesList = [];

const DATASET_PATH = 'data/labeled_dataset.csv';

const getFile = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').toString();
const getCSV = (path) => Papa.parse(getFile(path), {header: true});

function init() {
    // load lexicons
    const emotes = getCSV(EMOTES_PATH);
    const emojis = getCSV(EMOJIS_PATH);
    const vader = getCSV(VADER_PATH);
    const lexicaData = [];
    lexicaData.push(...emotes.data);
    lexicaData.push(...emojis.data);
    lexicaData.push(...vader.data);

    // merge data and create HashMap for lookup
    for (const item of lexicaData) {
        if (!Object.prototype.hasOwnProperty.call(lexica, item.word)) {
            lexica[item.word] = item;
        }
    }

    emotesList = emotes.data.map((e) => e.word);
}




const computeProbablitiy = (matrix) => matrix.reduce((a , c) => {
    a.negative *= c.negative;
    a.neutral *= c.neutral;
    a.positive *= c.positive;
    return a;
}, {negative: 1, neutral: 1, positive: 1});

function getSentiment({positive, neutral, negative}) {
    if (positive > neutral) {
        return positive > negative ? '1' : '-1';
    } else {
        return neutral > negative ? '0' : '-1';
    }
}

const accuracy = (dataset, actualColumnName, predictedCloumnName) => {
    let correct = 0;
    let total = 0;
    for (const row of dataset) {
        if (row[actualColumnName] == row[predictedCloumnName]) correct += 1;
        total += 1;
    }

    return correct/total;
}

function computeSentiment(dataset) {
    for (const [index, item] of dataset.entries()) {
        const tokens = tokenize(item.message, emotesList);
        // console.log('tokens', tokens);
        const prob = [];
        let sentiment = 0;
        let inferred = false;
        let class_scores = [0.33, 0.34, 0.33]
    
        if(tokens.length) {
            for (const token of tokens) {
                if (token.endsWith('_NEG')) token = token.replace('_NEG', '');
    
                if (lexica[token]) prob.push(lexica[token]);
            }
        }
        if (prob.length) {
            // console.log(prob);
            const classProds = computeProbablitiy(prob);
            // console.log(classProds);
            sentiment = getSentiment(classProds);
            const sum = Object.values(classProds).reduce((a , c) => a + c);
            inferred = true;
            class_scores = [classProds.negative/sum, classProds.neutral/sum, classProds.positive/sum];
        }
    
        dataset[index]['pred_sentiment'] = sentiment;
        // dataset[index]['class_scores'] = {negative: class_scores[0], neutral: class_scores[1], positive: class_scores[2]};
        dataset[index]['class_scores'] = class_scores.join('-');
        dataset[index]['inferred'] = inferred;
        // dataset[index]['correct'] = dataset[index]['sentiment'] === dataset[index]['pred_sentiment'];
    }

    return dataset;
}




function main() {
    // const inputData = getCSV(DATASET_PATH);
    // let dataset = [...inputData.data];
    const inputData = getFile('data/blizzcon18.txt');
    let dataset = [];
    for (const line of inputData.split('\n')) {
        const datetime = line.substring(line.indexOf('[') + 1, line.indexOf(']') - 3).trim();
        const [date, time] = datetime.split(' ');
        const part = line.substring(line.indexOf(']') + 1);
        const message = part.substring(part.indexOf(':') + 1).trim();
        dataset.push({datetime, date, time, message});
    }
    // const inputData = getFile('missed.txt');
    // let dataset = [];
    // for (const line of inputData.split('\n')) {
    //     dataset.push({message: line});
    // }
    // dataset = dataset.slice(1504, 1505);
    // console.log(dataset);
    init();
    dataset = computeSentiment(dataset);
    console.log(dataset);

    // scores
    // console.log('Accuracy', accuracy(dataset, 'sentiment', 'pred_sentiment'));

    // store result
    save(dataset, 'blizz_out.csv');
    
}

function save(dataset, path) {
    writeFileSync(new URL(path, import.meta.url), Papa.unparse(dataset));
}

main();





