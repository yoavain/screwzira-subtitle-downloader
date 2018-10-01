const fs = require('fs');
const fsextra = require("fs-extra");
const path = require('path');
const winston = require('winston');
const WindowsToaster = require('node-notifier').WindowsToaster;
const ScrewziraConfig = require('./screwziraConfig');
const ScrewziraUtils = require('./screwziraUtils');
const Notifier = require('./notifier');
const Classifier = require('./classifier');

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, 'Screwzira-Downloader'));

// Logger
const logFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader.log');
const logger = winston.createLogger({
	level: 'debug',
	transports: [new winston.transports.File({ filename: logFile })]
});

// Notifier
const snoreToastPath = process.argv[0].endsWith("screwzira-downloader.exe") ? path.join(process.argv[0], "../", "SnoreToast.exe") : null;
const notifier = new Notifier(logger, snoreToastPath);

// Config
const confFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader-config.json');
const screwziraConfig = new ScrewziraConfig(confFile, logger);

// File classifier
const classifier = new Classifier(logger, screwziraConfig);

// Screwzira Utils
const screwziraUtils = new ScrewziraUtils(logger, notifier, classifier);

// Main
if (process.argv.length > 2) {
	logger.log('info', `*** Looking for subtitle for "${process.argv[2]}" ***`);
	let fullpath = process.argv[2].replace(/\\/g, "/");
	let relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"));
	let split = fullpath.split('/');
	let filename = split[split.length - 1];
	let filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
	let parentFolder = split[split.length - 2];
	
	let classification = classifier.classify(filenameNoExtension, parentFolder);
	
	logger.log('verbose', `Classification response: ${JSON.stringify(classification)}`);
	
	if (classification.type === "movie") {
        screwziraUtils.handleMovie(classification.movieName, classification.movieYear, filenameNoExtension, relativePath);
	}
	else if (classification.type === "episode") {
        screwziraUtils.handleEpisode(classification.series, classification.season, classification.episode, filenameNoExtension, relativePath);
	}
	else {
        notifier.notif(`Unable to classify input file as movie or episode`);
	}
}
else {
	logger.log('error', '*** Missing input file ***');
    notifier.notif(`Missing input file`);
}
