import axios from "axios";
import { stringify } from "qs"
import { io, Socket } from "socket.io-client"
import { ColorVariant, IGameState } from "./types";
import { sleep } from "./utlis";

axios.defaults.withCredentials = true
const API_HOST = 'https://dicechess.dev/api/v2';
const SOCKET_IO_HOST = 'https://dicechess.dev:443';

const login = async (login: string, password: string) => {
    return axios.post(`${API_HOST}/login`, stringify({ username: login, password, remember: false }))
}

class User {
    cookie: string;
    lobbySocket: Socket;
    gameSocket: Socket;
    mail: string;
    password: string;
    state: IGameState;
    color: ColorVariant;
    finished: boolean = false;
    deleteGames: boolean = true;
    games: {id: string, participating: boolean}[] = [];
    currentGame: {id: string, participating: boolean};
    chessmove: string;

    constructor(userMail: string, userPassword: string) {
        this.mail = userMail;
        this.password = userPassword;
    }

    async login(){
        const res = await axios.post(`${API_HOST}/login`, stringify({ username: this.mail, password: this.password, remember: false }));
        this.cookie = res.headers["set-cookie"][2];
        console.log(`Login succeed`);
        this.initLobbySocketConnection();
    }

    async createGame(){
        this.color = ColorVariant.white
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
                'Cookie': this.cookie
            }
        });
        const options = {
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': this.cookie
                    }
                }
            }
        }
        this.gameSocket = io(`${SOCKET_IO_HOST}/game/${ response.data.id}`, options);
        return response.data.id;
    }

    initLobbySocketConnection(){
        const options = {
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': this.cookie
                    }
                }
            }
        }
        this.lobbySocket = io(`${SOCKET_IO_HOST}/lobby`, options);
        //this.lobbySocket.emit("lobby:join", "in_progress");
        this.lobbySocket.emit("lobby:join", "awaiting");
        //this.lobbySocket.emit("lobby:join", "finished");

        this.lobbySocket.on("lobby:add", (games: {id: string, participating: boolean}[]) => {
            this.games = games;
        });
    }

    async deleteAllGames(){
        for(let game of this.games){
            const res = await axios.delete(`${API_HOST}/game/${game.id}`,  {
                withCredentials: true,
                headers: {
                    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
                    'Cookie': this.cookie
                }
            });
        }
    }

    joinGame(gameId: string){
        this.color = ColorVariant.black;
        const options = {
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': this.cookie
                    }
                }
            }
        }
        this.gameSocket = io(`${SOCKET_IO_HOST}/game/${gameId}`, options)
        this.gameSocket.emit("join");
        this.gameSocket.emit("init");
        this.initGameSocketConnection();
    }


    startGame(){
        this.gameSocket.emit('init');
    }
    initGameSocketConnection(){
        this.gameSocket.on("init", data => {
            console.log(data);
        })
        this.gameSocket.on("state", (state: IGameState) => {
            this.state = state;
            console.log(this.state)
        });
        this.gameSocket.on("over", (result) => {
            this.finished = true;
        });
    }

    move(move: string){
        this.gameSocket.emit('move',  move)
        this.gameSocket.on("over", ()=>{
            this.finished=true;
        })
    }

    roll(){
        this.gameSocket.emit("roll")
    }


    isMyMove(){
        return this.state.fen.split(' ')[1] === this.color;
        console.log(this.color)
    }
    hasMoves(){
        return this.state.legalMoves.length > 0;
        
    }

    getMove(){
        return this.state.legalMoves[0];
        console.log(this.state.legalMoves[0])
        this.chessmove = this.state.legalMoves[0]
    }

  

}
let finished=false;
const createGame = async () => {
    let Ukraken = new User("ukraken@bk.ru", "799303zdes");
    let mobUkraken = new User("harlequinscodex@gmail.com", "684716zdes");

    await Ukraken.login();
    await sleep(1);
    await Ukraken.deleteAllGames();
    await mobUkraken.login();
    await sleep(1);
    await mobUkraken.deleteAllGames();

    const gameId = await Ukraken.createGame();
    mobUkraken.joinGame(gameId);
    Ukraken.startGame();
    while(finished==false){

    
        
            while(Ukraken.isMyMove()){
                if(Ukraken.hasMoves()){
                    Ukraken.move(Ukraken.getMove());
                }
                else {
                  Ukraken.roll();  
                }
                await sleep(1);
                finished=Ukraken.finished
            }
            while(mobUkraken.isMyMove()){
                if(mobUkraken.hasMoves()){
                    mobUkraken.move(mobUkraken.getMove());
                }
                else {
                  mobUkraken.roll();  
                }
                await sleep(1);
                finished=mobUkraken.finished
            }
            await sleep(1);
    }
}
   
