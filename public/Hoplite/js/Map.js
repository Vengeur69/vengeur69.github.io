import Cell from "./Cell.js";
import Player from "./Player.js";

export default class Map {
    constructor(canvasDOM, ctx) {
        this.ctx = ctx;
        this.canvasDOM = canvasDOM;
        this.tiles = [];
        this.tilesList = [];
        this.chopX = 5;
        this.cellFitWidth = ((this.chopX * 2 - 1) * 2) + (this.chopX * 2);
        this.cellSize = this.ctx.canvas.width < this.ctx.canvas.height ? this.ctx.canvas.width / this.cellFitWidth * 2 - 1 : Math.floor(this.ctx.canvas.height / 11 / Math.sqrt(3));
        this.player;
        this.demons = [];
        this.neighbourCoords = [
                [0, 1, -1],
        [1, 0, -1], [1, -1, 0],
        [-1, 0, 1], [-1, 1, 0],
                [0, -1, 1]
        ];
    }

    set(_x, _y, _z) {
        if (this.tiles[`${_x},${_y},${_z}`] === undefined) {
            this.tiles[`${_x},${_y},${_z}`] = new Cell({x: _x, y: _y, z: _z, size: this.cellSize, ctx: this.ctx});
        }
    }

    get(x, y, z) {
        return this.tiles[`${x},${y},${z}`];
    }

    mouse_to_coords(e) {
        let totalOffsetX = 0;
        let totalOffsetY = 0;
        let currentElement = this.canvasDOM;

        do{
            totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
            totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
        }
        while(currentElement = currentElement.offsetParent)

        let mouseX = e.pageX - totalOffsetX - this.ctx.canvas.width / 2;
        let mouseY = e.pageY - totalOffsetY - this.ctx.canvas.height / 2;

        let q = (2 / 3 * mouseX) / this.cellSize;
        let r = (-1 / 3 * mouseX + Math.sqrt(3) / 3 * mouseY) / this.cellSize;

        let x = q;
        let z = r;
        let y = -x - z;
        return this.cube_round(x, y, z);
    }

    cube_round(x, y, z) {
        let rx = Math.round(x);
        let ry = Math.round(y);
        let rz = Math.round(z);

        let x_diff = Math.abs(rx - x);
        let y_diff = Math.abs(ry - y);
        let z_diff = Math.abs(rz - z);

        if (x_diff > y_diff && x_diff > z_diff) {
            rx = -ry - rz;
        } else if (y_diff > z_diff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }
        return this.tiles[`${rx},${ry},${rz}`];
    }

    cube_distance(tileA, tileB) { //// heuristics : use manhattan distances  ////
        return Math.max(Math.abs(tileA.x - tileB.x), Math.abs(tileA.y - tileB.y), Math.abs(tileA.z - tileB.z));
    }

    cube_lerp(tileA, tileB, t) {
        let x = tileA.x + (tileB.x - tileA.x) * t;
        let y = tileA.y + (tileB.y - tileA.y) * t;
        let z = tileA.z + (tileB.z - tileA.z) * t;
        return this.cube_round(x, y, z);
    }

    cube_line(tileA, tileB) {
        let N = this.cube_distance(tileA, tileB);
        let results = [];
        for (let i = 0; i < N; i++) {
            results.push(this.cube_lerp(tileA, tileB, 1.0 / N * i));
        }
        return results
    }

    has_ldv(tile1, tile2, demon){
        let ldv = true;
        let line = this.cube_line(tile1, tile2);
        line.forEach(tile => {
            if (!this.isNotObstacle(tile, demon)) {
                ldv = false;
            }
        });
        return ldv;
    }

    random(n) { // n excluded
        return Math.floor(Math.random() * Math.floor(n));
    }

    generateNeighbour(i, j, k, radius = 1, chopX = radius + 1, chopY = radius + 1, chopZ = radius + 1 ) {
        let neighbourList = [];
        this.neighbourCoords.forEach(coords => {
            if (Math.abs(i + coords[0]) < chopX && Math.abs(j + coords[1]) < chopY && Math.abs(k + coords[2]) < chopZ) {
                this.set(i + coords[0], j + coords[1], k + coords[2]);
                neighbourList.push(this.get(i + coords[0], j + coords[1], k + coords[2]));
            }
        });
        return neighbourList;
    }

    generate(radius = 1, chopX = radius + 1, chopY = radius + 1, chopZ = radius + 1, x = 0, y = 0, z = 0) {
        if (radius > 0) {
            radius--;
            this.generateNeighbour(x, y, z, radius, chopX, chopY, chopZ).forEach(el => {
                if (Math.abs(el.x) < chopX && Math.abs(el.y) < chopY && Math.abs(el.z) < chopZ) {
                    this.generate(radius, chopX, chopY, chopZ, el.x, el.y, el.z);
                }
            });
        }
    }

    save() {
        for (const tile in this.tiles) {
            this.tilesList[this.tiles[tile].id] = this.tiles[tile];
        }
    }

    init(radius = 1, chopX = radius + 1, chopY = radius + 1, chopZ = radius + 1) {
        this.generate(radius, chopX, chopY, chopZ);
        this.save();
    }

    generateLava(skin, lavaNumber = 3) {
        let lavaSource = [];
        this.tilesList.forEach(tile => {
            if (this.isClean(tile) && this.random(10) === 0 && lavaNumber > 0) {
                tile.isLava = true;
                tile.skin = skin;
                lavaSource.push(tile);
                lavaNumber--;
            }
        });
        lavaSource.forEach(lava => {
            this.generateLavaNeighbour(skin, lava, 1.6);
        });
    }

    generateLavaNeighbour(skin, lava, chance = 2) { //1.6 to 2 is quite good
        this.getNeighbours(lava).forEach(tile => {
            if (!tile.AStar_visited) {
                tile.AStar_visited = true;
                if (this.isClean(tile) && this.random(chance) === 0) {
                    tile.isLava = true;
                    tile.skin = skin;
                    this.generateLavaNeighbour(skin, tile, chance * chance);
                }
            }
        });
    }

    getNeighbours(tile, clean = false) {
        let neighbourList = [];
        this.neighbourCoords.forEach(coords => {
            if (this.get(tile.x + coords[0], tile.y + coords[1], tile.z + coords[2])) {
                neighbourList.push(this.tilesList[this.get(tile.x + coords[0], tile.y + coords[1], tile.z + coords[2]).id]);
            }
        });

        if (clean) { // return isClean(Neighbours) only
            let index = neighbourList.length - 1;
            while (index >= 0) {
                if (!this.isClean(neighbourList[index])) {
                    neighbourList.splice(index, 1);
                }
                index--;
            }
        }

        return neighbourList;
    }

    createPlayer(skin, x, y, z) {
        this.player = new Player(this, skin, this.tiles[`${x},${y},${z}`]);
    }

    isClean(tile, observer = null) {
        return observer !== null && tile === observer.tile || !(tile === undefined || !tile instanceof Cell || tile.isWall || tile.isOccupied || tile.isLava);
    }

    isNotObstacle(tile, observer = null) { // Ldv Obstruction
        return observer !== null && tile === observer.tile || !(tile === undefined || !tile instanceof Cell || tile.isWall || tile.isOccupied);
    }
}
