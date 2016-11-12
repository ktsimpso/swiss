(function() {
	fetch('/data/players.json')
		.then((response) =>
			response.json())
		.then((players) =>
			players.map((player) => {
				player.wins = 0;
				player.losses = 0;
				player.pairings = [];
				return player;
			}))
		.then((players) => {
			var BYE = {
					'name': 'BYE',
					wins: 0,
					pairings: []
				},
				regexSpecialCharaters = ['^','$','.','?','|','-','[',
					']','\\','*','+',':','{','}',',','!','(',')','/'
				].reduce((obj, value) =>
					Object.defineProperty(obj, value, {value: `\\${value}`})
				, {}),
				htmlEncodeMap = {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;',
					'`': '&#x60;',
					' ': '&nbsp;',
					'!': '&#33;',
					'@': '&#64;',
					'$': '&#36;',
					'%': '&#37;',
					'(': '&#40;',
					')': '&#41;',
					'=': '&#x3D;',
					'+': '&#43;',
					'{': '&#123;',
					'}': '&#125;',
					'[': '&#91;',
					']': '&#93;',
					'/': '&#x2F;'
				},
				htmlEncodeRegex = new RegExp(
					`[${Object.keys(htmlEncodeMap).map((key) =>
						`${regexSpecialCharaters[key] || key}`)
						.join('')}]`,
				'g'),
				escapeHtml = (string) =>
					String(string).replace(htmlEncodeRegex, (value) =>
						htmlEncodeMap[value]),
				htmlTemplateHandler = (strings, ...values) =>
					values.map((value, index) =>
							`${strings.raw[index]}${escapeHtml(value)}`)
						.concat(strings.raw[strings.length -1])
						.join(''),
				playerInformationTemplate = (player) =>
					htmlTemplateHandler`<div class="player">
						<div>
							${player.name}
						</div>
						<object type="application/pdf" data=/${player.link}></object>
						<button>
							${player.name} wins
						</button>
					</div>`,
				playerStandingTemplate = (player) =>
					htmlTemplateHandler`${player.name} (${player.wins}-${player.losses})`,
				pairingTemplate = (pair) =>
					pair[1] !== BYE ? 
						`<div>
							${playerStandingTemplate(pair[0])} vs ${playerStandingTemplate(pair[1])}
						</div>`:
						`<div>
							${playerStandingTemplate(pair[0])} gets a bye
						</div>`,
				shuffleArray = (array) => {
					var currentIndex, randomIndex;

					for (currentIndex = array.length - 1; 0 < currentIndex; currentIndex -= 1) {
						randomIndex = Math.floor(Math.random() * (currentIndex + 1));
						[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
					}
					return array;
				},
				container = document.getElementById('container'),
				clearElement = (element) => {
					while(element.firstChild) {
						element.removeChild(element.firstChild);
					}
				},
				convertTextToDom = (text) => {
					var wrapper = document.createElement('div');
					wrapper.insertAdjacentHTML('beforeend', text);
					return wrapper.childNodes.length === 1
						? wrapper.firstChild
						: wrapper.childNodes;
				},
				resolveAfterClick = (buttons, resolve) => {
					var buttonHandlers = buttons.map((button, index) =>
						() => {
							buttons.forEach((button, index) =>
								button.removeEventListener('click', buttonHandlers[index]));
							clearElement(container);
							resolve(button, index);
						}
					)
					buttons.forEach((button, index) =>
						button.addEventListener('click', buttonHandlers[index]));

					if (buttons.length === 0) {
						resolve();
					}
				},
				createPairings = (players, round) => {
					var groupedPlayers = players
							.reduce((groups, player) => {
								groups[round - player.wins].push(player);
								return groups;
							}, Array.from(new Array(round + 1), () => []))
							.map(shuffleArray),
						addPair = (pair) => {
							pair[0].pairings.push(pair[1]);
							pair[1].pairings.push(pair[0]);
							pairs.push(pair);
						},
						sumPair = (sum, player) => sum + player.wins,
						pairs = [],
						leftovers = [];

					groupedPlayers.forEach((group) => {
						var findPairing = (item) =>
								(list) => {
									var matchIndex = list.findIndex((other) =>
										!item.pairings.includes(other));

									if (matchIndex !== -1) {
										addPair(list.splice(matchIndex, 1).concat(item));
										return true;
									}
								},
							item;

						while(group.length) {
							item = group.splice(0, 1)[0];
							
							if (![leftovers, group].some(findPairing(item))) {
								leftovers.push(item);
							}
						}
					});

					leftovers.forEach((leftover) =>
						addPair([leftover, BYE]));

					return pairs.sort((a, b) => b.reduce(sumPair, 0) - a.reduce(sumPair, 0));
				},
				renderPairings = (pairs) =>
					new Promise((resolve) => {
						container.insertAdjacentHTML('beforeend', pairs
							.map(pairingTemplate)
							.concat(`<button>Start round</button>`)
							.join(''));
						
						resolveAfterClick([...container.getElementsByTagName('button')],
							() => resolve(pairs));
					}),
				renderStandings = (players, noClear) =>
					new Promise((resolve) => {
						container.insertAdjacentHTML('beforeend', players
							.sort((player1, player2) => player2.wins - player1.wins)
							.map((player) =>
								`<div>
									${playerStandingTemplate(player)}
								</div>`)
							.concat(`${!noClear ? `<button>Continue</button>` : ``}`)
							.join(''));

						resolveAfterClick([...container.getElementsByTagName('button')],
							() => resolve(players));
					}),
				comparePair = (pair) =>
					new Promise((resolve) => {
						if (pair[1] === BYE) {
							pair[0].wins += 1;
							resolve();
							return;
						}

						container.insertAdjacentHTML('beforeend',
							`<div class="compareWrapper">
								${playerInformationTemplate(pair[0])}
								${playerInformationTemplate(pair[1])}
							</div>`);

						resolveAfterClick([...container.getElementsByTagName('button')], (button, index) => {
							pair[index].wins += 1;
							pair[(index + 1) % 2].losses += 1;
							resolve();
						});
					}),
				runRound = (players, round) =>
					renderPairings(createPairings(players, round)).then((pairs) =>
						pairs.reduce((chain, pair) =>
							chain.then(() => comparePair(pair)),
							Promise.resolve()))
						.then(() => renderStandings(players)),
				runTournament = (players) =>
					Array.from(new Array(Math.ceil(Math.log2(players.length))), (x, index) => index)
						.reduce((chain, round) =>
							chain.then((players) => runRound(players, round)),
							Promise.resolve(players));
				
			runTournament(players)
				.then((players) => renderStandings(players, true));
		});
}());
