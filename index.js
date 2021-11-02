const { Client, Intents } = require('discord.js')
const mongoose = require('mongoose')
const table = require('text-table');
const { token, databaseConnectionString } = require('./config.json')

async function main() {
	connectDiscord()
	connectDatabase()
}

 
/////////////
// DISCORD //
/////////////

async function connectDiscord(){
	const client = new Client({ intents: [Intents.FLAGS.GUILDS] })

	client.once('ready', () => {
		console.log('Ready!')
	})

	client.on('interactionCreate', async interaction => {
		if (!interaction.isCommand()) return
	
		const { commandName, user, options } = interaction
	
		if (commandName === 'ping') {
			await interaction.reply('Pong!')

		} else if (commandName === 'history') {
			await interaction.deferReply()
				const player = options.getUser('player') || user
				const response = await history(player)
			await interaction.editReply(response)

		} else if (commandName === 'addmatch') {
			await interaction.deferReply()
				const opponent = options.getUser('opponent')
				const player = options.getUser('player') || user
				const wins = options.getInteger('wins')		|| 0
				const losses = options.getInteger('losses')	|| 0
				const response = await addMatch(player, opponent, wins, losses)
			await interaction.editReply(response)

		} else if (commandName === 'stats') {
			await interaction.deferReply()
				const player = options.getUser('player') || user
				const response = await stats(player)
			await interaction.editReply(response)

		} else if (commandName === 'standings') {
			await interaction.deferReply()
				const response = await standings()
			await interaction.editReply(response)

		} else if (commandName === 'updateplayer') {
			await interaction.deferReply()
				const player = options.getUser('player') || user
				const response = await updatePlayerStats(player)
			await interaction.editReply(response)

		} else if (commandName === 'help') {
			const response = await help()
			await interaction.reply({ embeds: [response]})
		}


		
	})

	client.login(token)
}

///////////////
// FUNCTIONS //
///////////////

async function help(){
	return  new MessageEmbed()
	.setColor(0x3498DB)
	.setAuthor("Author Name, it can hold 256 characters", "https://i.imgur.com/lm8s41J.png")
	.setTitle("This is your title, it can hold 256 characters")
	.setURL("https://discord.js.org/#/docs/main/stable/class/MessageEmbed")
	.setDescription("This is the main body of text, it can hold 4096 characters.")
	.setImage("http://i.imgur.com/yVpymuV.png")
	.setThumbnail("http://i.imgur.com/p2qNFag.png")
	.addField("This is a single field title, it can hold 256 characters", "This is a field value, it can hold 1024 characters.")
	/*
	 * Inline fields may not display as inline if the thumbnail and/or image is too big.
	 */
	.addFields(
	  { name: "Inline fields", value: "They can have different fields with small headlines, and you can inline them.", inline: true },
	  { name: "Masked links", value: "You can put [masked links](https://discord.js.org/#/docs/main/master/class/MessageEmbed) inside of rich embeds.", inline: true },
	  { name: "Markdown", value: "You can put all the *usual* **__Markdown__** inside of them.", inline: true }
	)
	/*
	 * Blank field, useful to create some space.
	 */
	.addField("\u200b", "\u200b")
	/*
	 * Takes a Date object, defaults to current date.
	 */
	.setTimestamp()
	.setFooter("This is the footer text, it can hold 2048 characters", "http://i.imgur.com/w1vhFSR.png")

	/*
			'```' +
			'Hello! I\'m Otto, APD league stats bot!\n'+
			'I keep track of matches and standings, so you can know who qualifys for the final pod each month.\n\n'+

			'Here are my comands:\n'+
			'\t/addmatch - adds a match record into the database\n'+			
			'\t/standings - displays current top 15 players\n'+
			'\t/stats - displays players stats like match wins/losses, match win%, game win%...\n'+
			'\t/history - displays players last 9 matches\n'+
			'\t/updateplayer - double checks players stats and updates them if necessary\n'+
			'\t/help - displays this message'+
			'```'
	*/

}

async function standings(){
	const players = await playerModel.find().sort({matchWins: -1, matchWinPercentage: -1, gameWinPercentage: -1, opponentMatchWinPercentage: -1, opponentGameWinPercentage: -1} ).limit(15)
	
	let rows = [['Rank', 'Player', 'Match wins', 'Match win%', 'Game win%', 'Opp match win%', 'Opp game win%']]

	let rank = 1
	for(let player in players){
		rows.push([rank++, players[player].playerName, players[player].matchWins, players[player].matchWinPercentage.toFixed(2), players[player].gameWinPercentage.toFixed(2), players[player].opponentMatchWinPercentage.toFixed(2), players[player].opponentGameWinPercentage.toFixed(2)])
	}
	return '```' + table(rows) + '```'
}

async function stats(user){
	await checkIfPlayerExists(user)
	
	try{
		const player = await playerModel.findOne({playerId: user.id})

		let rows = [['Player:', player.playerName],
					['Match stats:', player.matchWins + '-' + player.matchLosses],
					['Game stats:', player.gameWins + '-' + player.gameLosses],
					['Match-win %:', player.matchWinPercentage.toFixed(2)],
					['Game-win %:', player.gameWinPercentage.toFixed(2)],
					['Opp Match-win %:', player.opponentMatchWinPercentage.toFixed(2)],
					['Opp Game-win %:', player.opponentGameWinPercentage.toFixed(2)]]

		return	'```' + table(rows) + '```'

	}catch(e){
		console.error(e)
	}
}

async function history(user){
	await checkIfPlayerExists(user)
	try{
		let matches = await matchModel.aggregate([
			{
				$match: {
					 $or : [{playerOneId: user.id}, {playerTwoId: user.id }] 
				}
			},
			{
				$sort: { date: -1 }
			},
			{ 
				$limit: 9
			},
			{
				$lookup: {
				  from: 'playermodels',
				  let: { playerOneId: '$playerOneId', playerTwoId: '$playerTwoId' },
				  pipeline: [{ 
					  $match: { 
						  $expr: { 
							  $and: [
								{ $ne: [ '$playerId', user.id ] },
								{ $or : [
									{ $eq: ['$playerId', '$$playerOneId']},
									{ $eq: ['$playerId', '$$playerTwoId']}
								]}
							  ]
							}
						}
					}],
				 as: 'opponent'
				}
			},
			{
			  $unwind: {
				path: '$opponent'
			  }
			},
			{ $project: {
				playerOneId: true,
				playerTwoId: true,
				winsPlayerOne: true,
				winsPlayerTwo: true,
				date: true,
				opponent: '$opponent.playerName'
			}}
		])
		

		let rows = [['Opponent', 'wins', 'losses']]

		for(let match in matches){
			if(user.id === matches[match].playerOneId){
				rows.push([matches[match].opponent, matches[match].winsPlayerOne, matches[match].winsPlayerTwo])
			}else{
				rows.push([matches[match].opponent, matches[match].winsPlayerTwo, matches[match].winsPlayerOne])
			}
		}
		return '```History for player ' + user.username + '\n' + table(rows) + '```'
	}catch(e){
		console.error(e)
	}
}

async function updatePlayerStats(user){
	await checkIfPlayerExists(user)

	let matches = await matchModel.aggregate([
		{
			$match: {
				 $or : [{playerOneId: user.id}, {playerTwoId: user.id }] 
			}
		},
		{
			$lookup: {
			  from: 'playermodels',
			  let: { playerOneId: '$playerOneId', playerTwoId: '$playerTwoId' },
			  pipeline: [{ 
				  $match: { 
					  $expr: { 
						  $and: [
							{ $ne: [ '$playerId', user.id ] },
							{ $or : [
								{ $eq: ['$playerId', '$$playerOneId']},
								{ $eq: ['$playerId', '$$playerTwoId']}
							]}
						  ]
						}
					}
				}],
			 as: 'opponent'
			}
		},
		{
		  $unwind: {
			path: '$opponent'
		  }
		}
	])

	let matchWins = 0
	let matchLosses = 0
	let gameWins = 0
	let gameLosses = 0

	let opponentMatchWinPercentage = 0
	let opponentGameWinPercentage = 0

	for(let match in matches){
		if(user.id === matches[match].playerOneId){
			gameWins += matches[match].winsPlayerOne
			gameLosses += matches[match].winsPlayerTwo

			if(matches[match].winsPlayerOne > matches[match].winsPlayerTwo){
				matchWins++
			}else{
				matchLosses++
			}

			opponentMatchWinPercentage += matches[match].opponent.matchWinPercentage
			opponentGameWinPercentage += matches[match].opponent.gameWinPercentage
		}else{
			gameWins += matches[match].winsPlayerTwo
			gameLosses += matches[match].winsPlayerOne

			if(matches[match].winsPlayerOne < matches[match].winsPlayerTwo){
				matchWins++
			}else{
				matchLosses++
			}

			opponentMatchWinPercentage += matches[match].opponent.matchWinPercentage
			opponentGameWinPercentage += matches[match].opponent.gameWinPercentage
		}
	}

	let matchWinPercentage = matchWins/(matchWins+matchLosses)
	matchWinPercentage = isNaN(matchWinPercentage) ? 0 : matchWinPercentage > 0.33 ? matchWinPercentage : 0.33
	let gameWinPercentage = gameWins/(gameWins+gameLosses)
	gameWinPercentage = isNaN(gameWinPercentage) ? 0 : gameWinPercentage > 0.33 ? gameWinPercentage : 0.33

	opponentMatchWinPercentage = matches.length == 0 ? 0 : opponentMatchWinPercentage/matches.length
	opponentGameWinPercentage = matches.length == 0 ? 0 : opponentGameWinPercentage/matches.length

	await playerModel.findOneAndUpdate({playerId: user.id},
		{
			$set: {
				matchWins: matchWins,
				matchLosses: matchLosses,
				gameWins: gameWins,
				gameLosses: gameLosses,
				matchWinPercentage: matchWinPercentage,
				gameWinPercentage: gameWinPercentage,
				opponentMatchWinPercentage: opponentMatchWinPercentage,
				opponentGameWinPercentage: opponentGameWinPercentage
			}
		}
	)

	return 'Player stats updated!'
}

async function addMatch(user1, user2, wins, losses){
	await checkIfPlayerExists(user1)
	await checkIfPlayerExists(user2)
	try{

		const newMatch = new matchModel({
			playerOneId: user1.id,
			playerTwoId: user2.id,
			winsPlayerOne: wins,
			winsPlayerTwo: losses,
			date: Date()
		})

		await newMatch.save(async (err) => {
			await updatePlayerStats(user1)
			await updatePlayerStats(user2)
			if (err) return handleError(err)
		})

		let rows = [[user1.username, user2.username], [wins, losses]]
		let options = { align: [ 'c', 'c' ] }

		return '```' + table(rows, options) + '```'
	}catch(err){
		console.error(err)
	}
}

async function checkIfPlayerExists(user){
	try {
		const exists = await playerModel.exists({ playerId: user.id })
		if(!exists){
			try{
				const newPlayer = new playerModel({
					playerId: user.id,
					playerName: user.username,
					matchWins: 0,
					matchLosses: 0,
					gameWins: 0,
					gameLosses: 0,
					matchWinPercentage: 0,
					gameWinPercentage: 0,
					opponentMatchWinPercentage: 0,
					opponentGameWinPercentage : 0
				})
				await newPlayer.save((err) => {
					if (err) return handleError(err)
				})
			}catch(e){
				console.error(e)
			}
		}
	} catch (err) {
		return console.error(err)
	}
}


//////////////
// DATABASE //
//////////////

async function connectDatabase(){
	await mongoose.connect(databaseConnectionString,  {useNewUrlParser: true, useUnifiedTopology: true});
    const db = mongoose.connection 
    db.on('error', console.error.bind(console, 'MongoDB connection error:'));
}

//////////////////////
// SCHEMAS & MODELS //
//////////////////////

const matchSchema = new mongoose.Schema({
	playerOneId: String,
    playerTwoId: String,
    winsPlayerOne: Number,
    winsPlayerTwo: Number,
    date: Date
})

const playerSchema = new mongoose.Schema({
    playerId: String,
	playerName: String,
	matchWins: Number,
	matchLosses: Number,
	gameWins: Number,
	gameLosses: Number,
	matchWinPercentage: Number,
	gameWinPercentage: Number,
	opponentMatchWinPercentage: Number,
	opponentGameWinPercentage : Number

})

const playerModel = mongoose.model('playerModel', playerSchema)
const matchModel = mongoose.model('matchModel', matchSchema)


//////////////
// RUN MAIN //
//////////////
main()


