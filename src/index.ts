import axios from "axios";
import { stringify } from "qs"
import { io, Socket } from "socket.io-client"
import { ColorVariant, IGameState } from "./types";
import { sleep } from "./utlis";


//axios.defaults.withCredentials = true
const API_HOST = 'https://dicechess.dev/api/v2';
const SOCKET_IO_HOST = 'https://dicechess.dev:443';


class User {
    cookie: string[];
    lobbySocket: Socket;
    gameSocket: Socket;
    mail: string;
    password: string;
    state: IGameState = {
        fen: "   ",
        legalMoves: [],
        legalPieces: [],
        undo: null
    }
    color: ColorVariant;
    finished: boolean = false;
    deleteGames: boolean = true;
    games: { id: string, participating: boolean, players: { id: string }[] }[] = [];
    currentGame: { id: string, participating: boolean };
    chessmove: string;
    states;
    userId: string;


    constructor(userMail: string, userPassword: string) {
        this.mail = userMail;
        this.password = userPassword;
    }

    async login() {
        const res = await axios.post(`${API_HOST}/login`, stringify({
            username: this.mail,
            password: this.password,
            remember: true
        }));
        this.cookie = res.headers["set-cookie"];
        console.log(`${this.mail} Login succeed `);
        this.initLobbySocketConnection();
    }

    async createGame() {
        this.color = ColorVariant.white;

        console.error(this.mail, this.cookie)
        const response = await axios.post(`${API_HOST}/game`, {
            "color": ColorVariant.white,
            "undo": 1,
            "position": 0,
            "rounds": 1,
            "private": 0,
            "time": 3,
            "increment": 3,
            "fen": "",
            "bet": 1,
            "doubling": true,
            "invite": ""
        }, {
            withCredentials: true,
            headers: {
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
                'Cookie': this.cookie.join('; ')
            }
        });
        const options = {
            forceNew: true,
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': this.cookie.join("; ")
                    }
                }
            }
        };

        this.gameSocket = io(`${SOCKET_IO_HOST}/game/${response.data.id}`, options);
        this.initGameSocketConnection();
        if (response.data.errors) {
            throw new Error('`Failed to create new game')
        }
        return response.data.id;

    }

    initLobbySocketConnection() {
        const options = {
            forceNew: true,
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': this.cookie.join('; ')
                    }
                }
            }
        }
        this.lobbySocket = io(`${SOCKET_IO_HOST}/lobby`, options);
        this.lobbySocket.emit("lobby:join", "in_progress");
        this.lobbySocket.emit("lobby:join", "awaiting");
        this.lobbySocket.on("error", data => {
           // console.log(data);
        })
        //this.lobbySocket.emit("lobby:join", "finished");

        this.lobbySocket.on("lobby:add", (games: any[]) => {
            this.games = games;
            //console.log(games)
        });
        this.lobbySocket.on('lobby:remove', (games: any[]) => {
           // console.log(`Removing`, games);
        })
    }

    async deleteAllGames() {
        console.log(this.mail, this.cookie)
        for (let game of this.games.filter(t => t.participating)) {
            try {
                const res = await axios.delete(`${API_HOST}/game/${game.id}`, {
                    withCredentials: true,
                    headers: {
                        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
                        'Cookie': this.cookie.join('; ')
                    }
                });
                //console.log(res.data, this.cookie)
            } catch (err) {
               // console.log(err);
            }

        }
    }

    joinGame(gameId: string) {
        this.color = ColorVariant.black;
        const options = {
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': this.cookie.join("; ")
                    }
                }
            }
        }
        this.gameSocket = io(`${SOCKET_IO_HOST}/game/${gameId}`, options)
        this.gameSocket.emit("join");
        this.initGameSocketConnection();
    }


    startGame() {
        this.gameSocket.emit('init');
    }

    initGameSocketConnection() {
        this.gameSocket.on("init", data => {
            this.state = data.state;
        })
        this.gameSocket.on("state", (state: IGameState) => {
            this.state = {
                legalMoves: [],
                legalPieces: [],
                ...state,
            }
        });
        this.gameSocket.on("over", (result) => {
            this.finished = true;
        });
        this.gameSocket.on("error", data => {
          //  console.log(data);
        })
    }

    move(move: string) {
        this.gameSocket.emit('move', move)
        this.gameSocket.on("over", () => {
            this.finished = true;
        })
    }

    roll() {
        this.gameSocket.emit("roll")

    }


    isMyMove() {
        return this.state.fen.split(' ')[1] === this.color;
        //console.log(this.color)
    }

    hasMoves() {
        // console.log(this.state);
        return this.state.legalMoves.length > 0;

    }

    getMove() {
        return this.state.legalMoves[0];
        //console.log(this.state.legalMoves[0])

    }

}

const getNewRandomUser = async (i?: number) => {
    const user = new User(`dicechesstest${i}@mail.ru`, "684716zdes")
    await user.login();
    await sleep(2);
    return user;
}

const playGame = async (mobUkraken: User, Ukraken: User) => {
    while (!mobUkraken.finished) {

        while (Ukraken.isMyMove()) {
            if (Ukraken.hasMoves()) {
                console.log(`${Ukraken.mail} makes move ${Ukraken.getMove()}`)
                Ukraken.move(Ukraken.getMove());
            } else {
                console.log(`${Ukraken.mail} rolls the dice`)
                Ukraken.roll();
            }
            await sleep(2);
        }

        while (mobUkraken.isMyMove()) {
            if (mobUkraken.hasMoves()) {
                console.log(`${mobUkraken.mail} makes move ${mobUkraken.getMove()}`)
                mobUkraken.move(mobUkraken.getMove());
            } else {
                console.log(`${mobUkraken.mail} rolls the dice`)
                mobUkraken.roll();
            }
            await sleep(2);
        }
        await sleep(2);
    }
}


const createGames = async () => {
    for (let i = 1; i <= 99; i = i + 2) {
        const user1 = await getNewRandomUser(i);
        const user2 = await getNewRandomUser(i + 1);
        await user1.deleteAllGames();
        await user2.deleteAllGames();


         const gameId = await user1.createGame();
        console.log(`Game created ${gameId}`)
        user2.joinGame(gameId);
        console.log(`Game joined ${gameId}`)
        await sleep(1);
        user1.startGame();
        await sleep(1);
        user2.startGame();
        console.log(`Game started ${gameId}`)
        await sleep(1);
        playGame(user1, user2); 
    }
}
createGames();