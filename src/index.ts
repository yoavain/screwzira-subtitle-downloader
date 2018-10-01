const fsextra = require('fs-extra');
const path = require('path');
const SzLogger = require('./szLogger');
const SzNotifier = require('./szNotifier');
const SzConfig = require('./szConfig');
const SzClassifier = require('./szClassifier');
const ScrewziraUtils = require('./screwziraUtils');

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, 'Screwzira-Downloader'));

// Logger
const logFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader.log');
const szLogger = new SzLogger(logFile);

// Notifier
const snoreToastPath = process.argv[0].endsWith("screwzira-downloader.exe") ? path.join(process.argv[0], "../", "SnoreToast.exe") : null;
const szNotifier = new SzNotifier(szLogger, snoreToastPath);

// Config
const confFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader-config.json');
const szConfig = new SzConfig(confFile, szLogger);
szLogger.setLogLevel(szConfig.getLogLevel());

// File classifier
const szClassifier = new SzClassifier(szLogger, szConfig);

// Screwzira Utils
const screwziraUtils = new ScrewziraUtils(szLogger, szNotifier, szClassifier);

// Main
if (process.argv.length > 2) {
    szLogger.log('info', `*** Looking for subtitle for "${process.argv[2]}" ***`);
	let fullpath = process.argv[2].replace(/\\/g, "/");
	let relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"));
	let split = fullpath.split('/');
	let filename = split[split.length - 1];
	let filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
	let parentFolder = split[split.length - 2];
	
	let classification = szClassifier.classify(filenameNoExtension, parentFolder);

    szLogger.log('verbose', `Classification response: ${JSON.stringify(classification)}`);
	
	if (classification.type === "movie") {
        screwziraUtils.handleMovie(classification.movieName, classification.movieYear, filenameNoExtension, relativePath);
	}
	else if (classification.type === "episode") {
        screwziraUtils.handleEpisode(classification.series, classification.season, classification.episode, filenameNoExtension, relativePath);
	}
	else {
        szNotifier.notif(`Unable to classify input file as movie or episode`);
	}
}
else {
    szLogger.log('error', '*** Missing input file ***');
    szNotifier.notif(`Missing input file`);
}
