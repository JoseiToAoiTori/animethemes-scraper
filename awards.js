const Snoowrap = require('snoowrap');
const config = require('./config.json');
const r = new Snoowrap(config);
const fs = require('fs');
const superagent = require('superagent');
const stringify = require('csv-stringify');

const json = [];
const records = [];

const showQuerySimple = `query ($id: [Int], $page: Int, $perPage: Int) {
	Page(page: $page, perPage: $perPage) {
	  pageInfo {
		total
		currentPage
		lastPage
	  }
	  results: media(type: ANIME, idMal_in: $id) {
		id
		idMal
		format
		startDate {
		  year
		}
		title {
		  romaji
		  english
		  native
		  userPreferred
		}
		coverImage {
		  large
		  extraLarge
		}
		siteUrl
	  }
	}
  }
  `;

async function paginatedQuery (query, idArr, page) {
	try {
		const response = await superagent
			.post('https://graphql.anilist.co')
			.send({
				query,
				variables: {
					id: idArr,
					page,
					perPage: 50,
				},
			})
			.set('accept', 'json');
		const data = response.body;
		return data;
	} catch (error) {
		console.log(error);
	}
}

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
		let malString = 0;
		if (mal.includes('myanimelist')) {
			malString = mal.match(/\/[0-9]+/gm)[0];
			malString = parseInt(malString.substring(1, malString.length), 10);
		}
		opName = opName.replace(/"/g, '');
		json.push({
			anime,
			mal: malString,
			link,
			opNum,
			opName,
		});
	}
}

// Execution begins here
function getPageContent () {
	r.getSubreddit('animethemes').getWikiPage('2020').content_md.then(async pageContent => {
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
		let IDs = json.map(entry => entry.mal);
		IDs = [...new Set(IDs)];
		const promiseArray = [];
		let showData = [];
		let pageNum = 1;
		const someData = await paginatedQuery(showQuerySimple, IDs, pageNum);
		showData = [...showData, ...someData.data.Page.results];
		const lastPage = someData.data.Page.pageInfo.lastPage;
		pageNum = 2;
		while (pageNum <= lastPage) {
		// eslint-disable-next-line no-async-promise-executor
			promiseArray.push(new Promise(async (resolve, reject) => {
				try {
					const returnData = await paginatedQuery(showQuerySimple, IDs, pageNum);
					resolve(returnData.data.Page.results);
				} catch (error) {
					reject(error);
				}
			}));
			pageNum++;
		}
		Promise.all(promiseArray).then(finalData => {
			for (const data of finalData) {
				showData = [...showData, ...data];
			}
			for (const theme of json) {
				const found = showData.find(show => show.idMal === theme.mal);
				let englishTitle = '';
				if (found.title.english) {
					englishTitle = found.title.english;
				}
				records.push([`${found.title.romaji}%${englishTitle}`, theme.opName, found.siteUrl, theme.opNum, theme.link]);
			}
			stringify(records, (err, output) => {
				if (err) console.log(err);
				// eslint-disable-next-line no-sync
				fs.writeFileSync('./theme-data.csv', output, 'utf-8');
				console.log('Successfully generated CSV');
			});
		});
	});
}

getPageContent();
