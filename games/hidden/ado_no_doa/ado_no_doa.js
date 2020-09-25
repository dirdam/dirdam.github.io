var html_board = document.getElementById("board");
var center_x = window.innerWidth/2;
var center_y = window.innerHeight/2;
var board_width = Math.min(window.innerWidth, window.innerHeight)*5/7; // 5/7 of min
var cell_width = board_width/5;
var button_width = cell_width*3/5;
// Pattern 1
//var sticks = [[3, 0], [3, 0, 1], [3, 0, 1], [0, 1], [2, 3, 0], [1, 2], [2, 3], [0, 1, 2], [2, 3, 0], [0, 1], [3, 0], [0, 1, 2], [2, 3], [1, 2, 3], [1, 2, 3], [1, 2]];
// Pattern 2 (corners inwards)
var sticks = [[1, 2], [3, 0, 1], [3, 0, 1], [2, 3], [2, 3, 0], [1, 2], [2, 3], [0, 1, 2], [2, 3, 0], [0, 1], [3, 0], [0, 1, 2], [0, 1], [1, 2, 3], [1, 2, 3], [3, 0]];
// Pattern 3 (squares)
//var sticks = [[1, 2], [1, 2, 3], [1, 2, 3], [2, 3], [0, 1, 2], [3, 0], [0, 1], [2, 3, 0], [0, 1, 2], [2, 3], [1, 2], [2, 3, 0], [0, 1], [3, 0, 1], [3, 0, 1], [3, 0]];

/* ============= Objects definitions ============= */

var Piece = function(html, x, y, sticks) {
	this.html = html;
	this.x = x;
	this.y = y;
	this.sticks = sticks.slice(); // Array of sticks. [0, 1, 2, 3] for 0, 3, 6, 9 in clock. "slice" needed to copy, not to reference
	this.setHTML();
}
Piece.prototype.setHTML = function() {
	this.html.style.width = cell_width + "px";
	this.html.style.height = cell_width + "px";
	html_board.appendChild(this.html);
	this.html.style.top = center_y - board_width/2 + this.y*cell_width - cell_width/2 + "px";
	this.html.style.left = center_x - board_width/2 + this.x*cell_width - cell_width/2 + "px";
	this.html.style["background-image"] = "url('doa.png')";
	this.html.style["background-size"] = "cover";
	this.html.style["background-position"] = "-" + (this.sticks.length == 2 ? 0 : cell_width) + "px 0px";
	this.html.style.transform = "rotate(" + this.sticks[0]*90 + "deg)";
}
Piece.prototype.setImage = function(image) {
	this.html.style["background-image"] = "url('" + image + "')";
}
Piece.prototype.rotate = function(direction) { // "direction" is -1/1
	for (var i = 0; i < this.sticks.length; i++) { // Apply rotation
		this.sticks[i] = this.sticks[i] + direction;
	}
	this.html.style.transform = "rotate(" + this.sticks[0]*90 + "deg)"; // Rotate
}

var Button = function(html, x, y, direction) {
	this.html = html;
	this.x = x;
	this.y = y;
	this.setHTML(direction);
}
Button.prototype.setHTML = function(direction) {
	this.html.classList.add("button"); // Add "button" as class
	this.html.classList.add(this.html.id);
	this.html.style.width = button_width + "px";
	this.html.style.height = button_width + "px";
	html_board.appendChild(this.html);
	var icon = document.createElement("i");
	icon.classList.add("fas");
	icon.classList.add("fa-arrow-up");
	icon.classList.add(this.html.id);
	this.html.appendChild(icon);
	this.html.style.transform = "rotate(" + direction*90 + "deg)";
	this.html.style.top = center_y - board_width/2 + this.y*cell_width - button_width/2 + "px";
	this.html.style.left = center_x - board_width/2 + this.x*cell_width - button_width/2 + "px";
}

var Tile = function(html, x, y) {
	this.html = html;
	html.style.width = cell_width + "px";
	html.style.height = cell_width + "px";
	html_board.appendChild(html);
	html.style.top = center_y - board_width/2 + y*cell_width + "px";
	html.style.left = center_x - board_width/2 + x*cell_width + "px";
}

var Board = function() {
	this.tiles = []; // Array of tiles
	this.pieces = []; // Array of pieces
	this.buttons = []; // Array of buttons
}
Board.prototype.initialize = function() {
	this.generateTiles();
	this.generateButtons();
	this.generatePieces();
}
Board.prototype.generateTiles = function() {
	for (var i = 0; i < 5; i++) {
		for (var j = 0; j < 5; j++) {
			var html_tile = document.createElement("div");
			html_tile.classList.add("tile"); // Add "tile" as class
			this.tiles.push(new Tile(html_tile, i, j));
		}
	}
}
Board.prototype.generateButtons = function() {
	for (var i = 0; i < 5; i++) {
		var html_button = document.createElement("div");
		html_button.id = 'button_top_' + (i + 0.5)
		this.buttons.push(new Button(html_button, 0.5 + i, 0, 2));
		var html_button = document.createElement("div");
		html_button.id = 'button_bottom_' + (i + 0.5)
		this.buttons.push(new Button(html_button, 0.5 + i, 5, 0));
		var html_button = document.createElement("div");
		html_button.id = 'button_left_' + (i + 0.5)
		this.buttons.push(new Button(html_button, 0, 0.5 + i, 1));
		var html_button = document.createElement("div");
		html_button.id = 'button_right_' + (i + 0.5)
		this.buttons.push(new Button(html_button, 5, 0.5 + i, 3));
	}
}
Board.prototype.generatePieces = function() {
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			var html_piece = document.createElement("div");
			html_piece.classList.add("piece"); // Add "piece" as class
			this.pieces.push(new Piece(html_piece, j + 1, i + 1, sticks[i*4 + j]));
		}
	}
}
Board.prototype.action = function(button_id) { // Rotates proper lane
	var parts = button_id.split("_");
	var side = parts[1];
	var order = parseFloat(parts[2]);
	var rotating_pieces = []; // Pieces to rotate
	var direction = []; // Pieces to rotate, direction (1 clockwise; -1 counter)
	for (var i = 0; i < this.pieces.length; i++) {
		if (["left", "right"].includes(side)) { // Horizontal
			if (this.pieces[i].y == Math.floor(order)) { // Upper row
				if (convert_modulo(this.pieces[i].sticks).includes(2)) { // Stick to push
					rotating_pieces.push(this.pieces[i]);
					direction.push(side == "left" ? -1 : 1);
				}
			}
			else if (this.pieces[i].y == Math.ceil(order)) { // Lower row
				if (convert_modulo(this.pieces[i].sticks).includes(0)) { // Stick to push
					rotating_pieces.push(this.pieces[i]);
					direction.push(side == "left" ? 1 : -1);
				}
			}
		}
		else if (["top", "bottom"].includes(side)) { // Vertical
			if (this.pieces[i].x == Math.floor(order)) { // Left column
				if (convert_modulo(this.pieces[i].sticks).includes(1)) { // Stick to push
					rotating_pieces.push(this.pieces[i]);
					direction.push(side == "top" ? 1 : -1);
				}
			}
			else if (this.pieces[i].x == Math.ceil(order)) { // Right column
				if (convert_modulo(this.pieces[i].sticks).includes(3)) { // Stick to push
					rotating_pieces.push(this.pieces[i]);
					direction.push(side == "top" ? -1 : 1);
				}
			}
		}
	}
	for (var i = 0; i < rotating_pieces.length; i++) {
		rotating_pieces[i].rotate(direction[i]);
	}
}
Board.prototype.randomize = function(steps) {
	for (var i = 0; i < steps; i++) {
		var num = Math.floor(Math.random()*this.buttons.length);
		this.action(this.buttons[num].html.id);
	}
}

/* ============= Common methods ============= */
function preloadImages(array) {
	for (var i = 0; i < array.length; i++) {
		var img = new Image();
		img.src = array[i];
	}
}

function checkEnd() {
	var result = true;
	for (var i = 0; i < board.pieces.length; i++) {
		if (JSON.stringify(convert_modulo(board.pieces[i].sticks)) != JSON.stringify(sticks[i])) {
			return false;
		}
	}
	return true;
}

function convert_modulo(array) {
	var result = [];
	for (var i = 0; i < array.length; i++) {
		result.push(((array[i]%4) + 4)%4);
	}
	return result;
}

function addGoal() {
	var html_goal = document.createElement("div");
	html_goal.classList.add("goal"); // Add "goal" as class
	html_goal.style.width = cell_width + "px";
	html_goal.style.height = cell_width + "px";
	html_goal.style.top = "0px";
	html_goal.style.left = window.innerWidth - cell_width + "px";
	html_goal.style["background-image"] = "url('pattern2.png')";
	html_goal.style["background-size"] = "contain";
	html_board.appendChild(html_goal);
}

/* ============= Initialization ============= */
// Preload images
preloadImages(['doa.png', 'doa-end.png', 'pattern2.png']);

// Table and pieces
var board = new Board();
board.initialize();
board.randomize(100);

// Add goal
addGoal();


/* ============= Events ============= */

document.addEventListener("click", function (e) {
	classes = event.target.className.split(" ");
	for (var i = 0; i < classes.length; i++) {
		if (classes[i].includes("button_")) {
			button_id = classes[i];
			button = document.getElementById(button_id);
			board.action(button.id);
		}
	}
	// End
	if (checkEnd()) {
		for (var i = 0; i < board.pieces.length; i++) {
			board.pieces[i].setImage("doa-end.png");
		}
	}
	else {
		for (var i = 0; i < board.pieces.length; i++) {
			board.pieces[i].setImage("doa.png");
		}
	}
	// Goal clicked
	if (classes[0] == "goal") {
		board = new Board();
		board.initialize();
	}
})