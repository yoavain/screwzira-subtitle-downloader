const fs = require('fs');
const path = require('path');
const request = require('request');

const baseUrl = 'http://api.screwzira.com';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36';

const movienameRegex = /((?:[^\(]+))\s+(?:\((\d+)\))/;

let cleanText = (text) => {
	return text.toLowerCase().replace(/[\.|-]/g, ' ');
}

let splitText = (text) => {
	return text.split(' ');
}

let commonWordsInSentences = (s1, s2, movieName, movieYear) => {
	let split1 = splitText(cleanText(s1));
	let split2 = splitText(cleanText(s2));
	let movieNameSplit = splitText(cleanText(movieName));
	let movieYearStr = movieYear.toString();
	
	let commonWords = split1.filter(word1 => word1.length > 1 && !movieNameSplit.includes(word1) && word1 !== movieYearStr && split2.includes(word1));
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

let findClosestMatch = (filenameNoExtension, list, relativePath, movieName, movieYear) => {
	console.log(`Looking for closest match to ${filenameNoExtension} from:\n${list && list.map(item => item.SubtitleName).join(',\n')}\n`);
	if (list && list.length > 0) {
		let maxCommonWords = commonWordsInSentences(filenameNoExtension, list[0].SubtitleName, movieName, movieYear);
		let maxIndex = 0;
		list.forEach((item, index) => {
			let commonWords = commonWordsInSentences(filenameNoExtension, item.SubtitleName, movieName, movieYear);
			if (commonWords.length > maxCommonWords.length) {
				maxCommonWords = commonWords;
				maxIndex = index;
			}
		})
		
		let bestMatch = list[maxIndex];
		console.log(`filename:  ${filenameNoExtension}`);
		console.log(`best match: ${bestMatch.SubtitleName}`);
		console.log(`common words: [\"${maxCommonWords.join('\", \"')}\"]`);
		
		let subtitleID = bestMatch.Identifier;
		downloadBestMatch(subtitleID, filenameNoExtension, relativePath);
	}
}

let handleSingleMovie = (movieName, movieYear, filenameNoExtension, relativePath) => {
	console.log(`Handling: ${movieName} (${movieYear})`);
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
	
	//console.log(JSON.stringify(options));

	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			findClosestMatch(filenameNoExtension, body && JSON.parse(body).Results, relativePath, movieName, movieYear);
		}
		else {
			console.log(error);
			if (response) {
				console.log(JSON.stringify(response));
			}
		}
	});
}

if (process.argv.length > 2) {
	let fullpath = process.argv[2].replace(/\\/g, "/");;
	console.log(`Looking for subtitle for ${fullpath}`);
	let relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"))
	let split = fullpath.split('/');
	let filename = split[split.length - 1];
	let filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
	let movieFolder = split[split.length - 2];
	
	let match = movienameRegex.exec(movieFolder);
	let movieName = match[1];
	let movieYear = Number(match[2]);
	
	handleSingleMovie(movieName, movieYear, filenameNoExtension, relativePath);
}
else {
	console.log('Missing input file');
}
