const Snoowrap = require('snoowrap');
const config = require('./config.json');
const r = new Snoowrap(config);
const fs = require('fs');

let csv = '';

function getThemes (anime, page, mal) {
	let tableContent = page.split(anime);
	tableContent.splice(0, 1);
	tableContent = tableContent.join(anime);
	while (!tableContent.startsWith('](')) {
		tableContent = tableContent.split(anime);
		tableContent.splice(0, 1);
		tableContent = tableContent.join(anime);
	}
	tableContent = tableContent.split(/-\|:-:\|:-:\|:-:\|:-:\|:-:|-\|:-:\|:-:\|:-:/)[1];
	tableContent = tableContent.split(/\r?\n\r?\n\r?/gm)[0];
	const themes = tableContent.split(/\r?\n/);
	if (themes[0].length === 0) themes.splice(0, 1);
	for (const theme of themes) {
		const splitData = theme.split('|');
		if (!splitData[0]) continue;
		const opData = splitData[0].split(' ');
		let opNum;
		let opName;
		if (/V[0-9]+/g.test(opData[1])) {
			opNum = `${opData[0]}${opData[1].toLowerCase()}`;
			opData.splice(0, 2);
			opName = opData.join(' ');
		} else {
			opNum = opData[0];
			opData.splice(0, 1);
			opName = opData.join(' ');
		}
		let link = splitData[1].match(/https:\/\/.*\)/gm);
		if (!link) continue;
		link = link[0].substring(0, link[0].length - 1);
		csv += `${anime},${opName},${opNum},${mal},${link}
`;
	}
}

// Execution begins here
function getPageContent () {
	r.getSubreddit('animethemes').getWikiPage('2020').content_md.then(pageContent => {
		const regex = /###\[(.*)\]\((.*)\)/gm;
		let m;
		while ((m = regex.exec(pageContent)) !== null) {
			let anime;
			let mal;
			// This is necessary to avoid infinite loops with zero-width matches
			if (m.index === regex.lastIndex) {
				regex.lastIndex++;
			}
			// The result can be accessed through the `m`-variable.
			m.forEach((match, groupIndex) => {
				if (groupIndex === 1) anime = match;
				else if (groupIndex === 2) mal = match;
			});
			getThemes(anime, pageContent, mal);
		}
		// eslint-disable-next-line no-sync
		fs.writeFileSync('./theme-data.csv', csv, 'utf-8');
	});
}

getPageContent();
