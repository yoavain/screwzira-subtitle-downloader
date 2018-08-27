const fs = require('fs');
const path = require('path');
const request = require('request');

const baseUrl = 'http://api.screwzira.com';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36';

const episodeRegex = /(.+?)S?0*(\d+)?[xE]0*(\d+)/;
const movieRegex = /((?:[^\(]+))\s+(?:\((\d+)\))/;

let cleanText = (text) => {
	return text.toLowerCase().replace(/[\.|-]/g, ' ').trim();
}

let splitText = (text) => {
	return text.split(' ');
}

let commonWordsInSentences = (s1, s2, excludeList) => {
	let split1 = splitText(cleanText(s1));
	let split2 = splitText(cleanText(s2));
	
	let commonWords = split1.filter(word1 => word1.length > 1 && !excludeList.includes(word1) && split2.includes(word1));
	//console.log(`"${s1}" & "${s2}" have ${commonWords.length} words in common [${commonWords.join("#")}]`);
	return commonWords;
}

let downloadBestMatch = (subtitleID, filenameNoExtension, relativePath) => {
	console.log(`Downloading: ${subtitleID}`);
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
	
	//console.log(JSON.stringify(options));

	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			let destination = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
			if (fs.existsSync(destination)) {
				destination = path.resolve(relativePath, filenameNoExtension + ".HebrewSZ.srt");
			}
			console.log(`writing response to ${destination}`);
			fs.writeFileSync(destination, body);
		}
		else {
			console.log(error);
			if (response) {
				console.log(JSON.stringify(response));
			}
		}
	});
}

let findClosestMatch = (filenameNoExtension, list, excludeList) => {
	console.log(`Looking for closest match to ${filenameNoExtension} from:\n${list && list.map(item => item.SubtitleName).join(',\n')}\n`);
	if (list && list.length > 0) {
		let maxCommonWords = commonWordsInSentences(filenameNoExtension, list[0].SubtitleName, excludeList);
		let maxIndex = 0;
		list.forEach((item, index) => {
			let commonWords = commonWordsInSentences(filenameNoExtension, item.SubtitleName, excludeList);
			if (commonWords.length > maxCommonWords.length) {
				maxCommonWords = commonWords;
				maxIndex = index;
			}
		})
		
		let bestMatch = list[maxIndex];
		console.log(`filename:  ${filenameNoExtension}`);
		console.log(`best match: ${bestMatch.SubtitleName}`);
		console.log(`common words: [\"${maxCommonWords.join('\", \"')}\"]`);
		
		return bestMatch.Identifier;
	}
}

let handleResponse = (error, response, body, excludeList, filenameNoExtension, relativePath) => {
	if (!error && response.statusCode == 200) {
		let subtitleID = findClosestMatch(filenameNoExtension, body && JSON.parse(body).Results, excludeList);
		downloadBestMatch(subtitleID, filenameNoExtension, relativePath);
	}
	else {
		console.log(error);
		if (response) {
			console.log(JSON.stringify(response));
		}
	}
}

let handleMovie = (movieName, movieYear, filenameNoExtension, relativePath) => {
	console.log(`Handling Movie: "${movieName}" (${movieYear})`);
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
	
	//console.log(JSON.stringify(options));

	request(options, (error, response, body) => {
		handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
	});
}

let handleEpisode = (series, season, episode, filenameNoExtension, relativePath) => {
		console.log(`Handling Series "${series}" Season ${season} Episode ${episode}`);
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
	
	console.log(JSON.stringify(options));

	request(options, (error, response, body) => {
		handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
	});
}

let clasify = (filenameNoExtension, parentFolder) => {
	let match = episodeRegex.exec(filenameNoExtension);
	if (match && match.length > 2) {
		return {
			type: "episode",
			series: cleanText(match[1]),
			season: Number(match[2]),
			episode: Number(match[3])
		}
	}
	else {
		let match = movieRegex.exec(parentFolder);
		return {
			type: "movie",
			movieName: match[1],
			movieYear: Number(match[2])
		}
	}
}


if (process.argv.length > 2) {
	let fullpath = process.argv[2].replace(/\\/g, "/");;
	console.log(`Looking for subtitle for ${fullpath}`);
	let relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"))
	let split = fullpath.split('/');
	let filename = split[split.length - 1];
	let filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
	let parentFolder = split[split.length - 2];
	
	let clasification = clasify(filenameNoExtension, parentFolder);
	
	console.log(JSON.stringify(clasification));
	
	if (clasification.type === "movie") {
		handleMovie(clasification.movieName, clasification.movieYear, filenameNoExtension, relativePath);
	}
	else if (clasification.type === "episode") {
		handleEpisode(clasification.series, clasification.season, clasification.episode, filenameNoExtension, relativePath);
	}
}
else {
	console.log('Missing input file');
}
