const Snoowrap = require('snoowrap');
const config = require('./config.json');
const pages = require('./pages.json');
const r = new Snoowrap(config);

const getPageContent = [];

for (const page of pages) {
	getPageContent.push(r.getSubreddit('animethemes').getWikiPage(page).content_md);
}

const json = [];

function getThemes (anime, page, mal) {
	let tableContent = page.split(anime);
	tableContent.splice(0, 1);
	tableContent = tableContent.join('');
	tableContent = tableContent.split('-|:-:|:-:|:-:|:-:|:-:')[1];
	tableContent = tableContent.split(/\r?\n\r?\n+/)[0];
	const themes = tableContent.split(/\r?\n/);
	if (themes[0].length === 0) themes.splice(0, 1);
	for (const theme of themes) {
		const splitData = theme.split('|');
		const opData = splitData[0].match(/((?:OP|ED)[0-9]*) (.*)/gm);
		if (!opData) continue;
		const opNum = opData[1];
		const opName = opData[2];
		let link = splitData[1].match(/https:\/\/.*\)/gm);
		if (!link) continue;
		link = link[0].substring(0, link.length - 1);
		json.push({
			anime,
			mal,
			link,
			opNum,
			opName,
		});
	}
}

Promise.all(getPageContent).then(pageContent => {
	for (const page of pageContent) {
		const regex = /###\[(.*)\]\((.*)\)/gm;
		let m;
		while ((m = regex.exec(page)) !== null) {
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

			getThemes(anime, page, mal);
		}
	}
	console.log(JSON.stringify(json));
});
