const fs = require('fs');
const fsextra = require("fs-extra");
const path = require('path');
const request = require('request');
const winston = require('winston');
const WindowsToaster = require('node-notifier').WindowsToaster;

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, 'Screwzira-Downloader'));

// Logger
const logFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader.log');
const logger = winston.createLogger({
	level: 'debug',
	transports: [new winston.transports.File({ filename: logFile })]
});

// Notifier
const customPath = process.argv[0].endsWith("screwzira-downloader.exe") ? path.join(process.argv[0], "../", "SnoreToast.exe") : null;
logger.log('debug', `Custom path: ${customPath}`);
const notifier = new WindowsToaster({
  withFallback: false,
  customPath: customPath
});

// Conf file
const confFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader-config.json');
if (!fs.existsSync(confFile)) {
    fsextra.outputJsonSync(confFile, { replacePairs: {} });
}
const conf = fsextra.readJsonSync(confFile);
const replacePairs = conf && conf.replacePairs && JSON.parse(JSON.stringify(conf.replacePairs).toLowerCase());
logger.log('debug', `Replace pairs (${Object.keys(replacePairs).length}): ${Object.keys(replacePairs).map(pairKey => pairKey + " => " + replacePairs[pairKey]).join('; ')}`);

// Request Info
const baseUrl = 'http://api.screwzira.com';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36';

// Regex
const episodeRegex = /(.+?)S?0*(\d+)?[xE]0*(\d+)/;
const movieRegex = /((?:[^\(]+))\s+(?:\((\d+)\))/;


let notify = (message: string) => {
	notifier.notify({
		title: 'Screwzira Subtitle Downloader',
		message
	});
};

let cleanText = (text: string): string => {
	return text.toLowerCase().replace(/[\.|-]/g, ' ').trim();
};

let replaceTitleIfNeeded = (text: string): string => {
    if (replacePairs && replacePairs[text]) {
        logger.log('info', `Replaced "${text}" with "${replacePairs[text]}" for query`);
        return replacePairs[text];
    }
    return text;
};

let splitText = (text: string): string[] => {
	return text.split(' ');
};

let commonWordsInSentences = (s1: string, s2: string, excludeList: string[]): string[] => {
	let split1 = splitText(cleanText(s1));
	let split2 = splitText(cleanText(s2));
	
	let commonWords = split1.filter(word1 => word1.length > 1 && !excludeList.includes(word1) && split2.includes(word1));
	logger.log('debug', `"${s1}" & "${s2}" have ${commonWords.length} words in common [${commonWords.join("#")}]`);
	return commonWords;
};

let downloadBestMatch = (subtitleID: string, filenameNoExtension: string, relativePath: string) => {
	logger.log('info', `Downloading: ${subtitleID}`);
	var options = {
		url: `${baseUrl}/Download`,
		method: 'POST',
		headers: { "User-Agent": userAgent, "Accept": "*/*" },
		encoding: null,
		json: {
			request: {
				subtitleID: subtitleID
			}
		}
	};
	
	logger.log('debug', JSON.stringify(options));

	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			let destination = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
			if (fs.existsSync(destination)) {
				destination = path.resolve(relativePath, filenameNoExtension + ".HebrewSZ.srt");
			}
			logger.log('verbose', `writing response to ${destination}`);
			fs.writeFileSync(destination, body);
			notify(`Successfully downloaded "${destination}"`);
		}
		else {
			logger.log('error', error);
			notify(`Failed dowloadeding subtitle`);
		}
	});
};

let findClosestMatch = (filenameNoExtension: string, list, excludeList: string[]): string => {
	logger.log('info', `Looking for closest match for "${filenameNoExtension}" from: [${list && list.map(item => item.SubtitleName).join(', ')}]`);
	if (list && list.length > 0) {
		let maxCommonWords = commonWordsInSentences(filenameNoExtension, list[0].SubtitleName, excludeList);
		let maxIndex = 0;
		list.forEach((item, index) => {
			let commonWords = commonWordsInSentences(filenameNoExtension, item.SubtitleName, excludeList);
			if (commonWords.length > maxCommonWords.length) {
				maxCommonWords = commonWords;
				maxIndex = index;
			}
		});
		
		let bestMatch = list[maxIndex];
		logger.log('info', `filename:  "${filenameNoExtension}"`);
		logger.log('info', `best match: "${bestMatch.SubtitleName}"`);
		logger.log('info', `common words: [\"${maxCommonWords.join('\", \"')}\"]`);
		
		return bestMatch.Identifier;
	}
};

let handleResponse = (error: any, response: any, body: any, excludeList: string[], filenameNoExtension: string, relativePath: string) => {
	if (!error && response.statusCode == 200) {
		let subtitleID = findClosestMatch(filenameNoExtension, body && JSON.parse(body).Results, excludeList);
		downloadBestMatch(subtitleID, filenameNoExtension, relativePath);
	}
	else {
		logger.log('error', error);
		if (response) {
			logger.log('error', JSON.stringify(response));
		}
	}
};

let handleMovie = (movieName, movieYear, filenameNoExtension, relativePath) => {
	logger.log('info', `Handling Movie: "${movieName}" (${movieYear})`);
	var options = {
		url: `${baseUrl}/FindFilm`,
		method: 'POST',
		headers: { "User-Agent": userAgent },
		json: {
			request: {
				SearchPhrase: movieName,
				SearchType: "FilmName",
				Version:"1.0",
				Year: movieYear
			}
		}
	};

	let excludeList = splitText(cleanText(movieName));
	excludeList.push(movieYear.toString());
	
	logger.log('debug', `Handle movie request options: ${JSON.stringify(options)}`);

	request(options, (error, response, body) => {
		handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
	});
};

let handleEpisode = (series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string) => {
		logger.log('info', `Handling Series "${series}" Season ${season} Episode ${episode}`);
	var options = {
		url: `${baseUrl}/FindSeries`,
		method: 'POST',
		headers: { "User-Agent": userAgent },
		json: {
			request: {
				SearchPhrase: series,
				SearchType: "FilmName",
				Version:"1.0",
				Season: season,
				Episode: episode
			}
		}
	};

	let excludeList = splitText(series);
	
	logger.log('debug', `Handle episode request options: ${JSON.stringify(options)}`);

	request(options, (error, response, body) => {
		handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
	});
};

let classify = (filenameNoExtension: string, parentFolder: string) => {
	let episodematch = episodeRegex.exec(filenameNoExtension);
	if (episodematch && episodematch.length > 2 && episodematch[1] && episodematch[2] && episodematch[3]) {
		logger.log('verbose', `Classification match: ${JSON.stringify(episodematch)}`);
		
		return {
			type: "episode",
			series: replaceTitleIfNeeded(cleanText(episodematch[1])),
			season: Number(episodematch[2]),
			episode: Number(episodematch[3])
		};
	}
	else {
		let movieMatch = movieRegex.exec(parentFolder);
		if (movieMatch && movieMatch.length > 1 && movieMatch[1] && movieMatch[2]) {
			return {
				type: "movie",
                movieName: replaceTitleIfNeeded(movieMatch[1]),
				movieYear: Number(movieMatch[2])
			};
		}
	}
	return {
		type: undefined
	};
};


if (process.argv.length > 2) {
	logger.log('info', `*** Looking for subtitle for "${process.argv[2]}" ***`);
	let fullpath = process.argv[2].replace(/\\/g, "/");
	let relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"));
	let split = fullpath.split('/');
	let filename = split[split.length - 1];
	let filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
	let parentFolder = split[split.length - 2];
	
	let clasification = classify(filenameNoExtension, parentFolder);
	
	logger.log('verbose', `Clasification response: ${JSON.stringify(clasification)}`);
	
	if (clasification.type === "movie") {
		handleMovie(clasification.movieName, clasification.movieYear, filenameNoExtension, relativePath);
	}
	else if (clasification.type === "episode") {
		handleEpisode(clasification.series, clasification.season, clasification.episode, filenameNoExtension, relativePath);
	}
	else {
		notify(`Unable to classify input file as movie or episode`);
	}
}
else {
	logger.log('error', '*** Missing input file ***');
	notify(`Missing input file`);
}
