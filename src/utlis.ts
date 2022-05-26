



export const sleep = (seconds: number) => {
    return new Promise<void>((res, rej) => {
        setTimeout(() => {
            res();
        }, seconds * 1000)
    })
}
