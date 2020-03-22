var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

function Stream() {
	this.subscribers = [];
	this.subscribe = function(callback) {
		this.subscribers.push(callback);
	};
	this.dispatch = function(action) {
		this.subscribers.forEach(callback => callback(action));
	};
}

let simulation = new Simulation(0, 10, 300, 300, 1, "#ff9933", [35]);
let simulation2 = new Simulation(0, 400, 300, 300, 0.2, "#cc00ff", [35]);

let graph = new Graph(800, 700, 600, [35]);

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	simulation.draw();
	simulation2.draw();
	graph.refresh([simulation.state.infections.data, simulation2.state.infections.data], [simulation.color, simulation2.color]);
}
setInterval(draw, 10);

function getRandom(max) {
	return (Math.random() * max);
}

function getRandomRange(min, max) {
	return (Math.random()*(max-min)+min);
}

function getLeg(hypotenuse, leg) {
	return Math.sqrt(hypotenuse*hypotenuse-leg*leg);
}

function getDistance(leg1, leg2) {
	return Math.sqrt(leg1*leg1 + leg2*leg2);
}

function maybeHappen(prob) {
	return (Math.random() <= prob);
}


function Simulation(x, y, width, height, percentMoving, color, criticalValue) {
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.moveProb = percentMoving;
	this.graphGap = 20;
	this.infectionProb = 0.10;
	this.deathProb = 0.05;
	this.color = color;
	this.criticalValue = criticalValue;
	
	this.state = {
		ticks: 0,
		sick: 1,
		collisions: 0,
		infections: new InfectionData(),
		graph: new Graph(this.x+this.width+this.graphGap, this.y+this.height, this.width, [this.criticalValue]),
	};

	this.stream = new Stream();

	this.tickCounter = function(action) {
		switch(action) {
			case "tick":
				this.state.ticks++;
				break;
			default:
				break;
		}
	};
	this.stream.subscribe(this.tickCounter.bind(this));

	this.collisionCounter = function(action) {
		switch(action) {
			case "collision":
				this.state.collisions++;
				break;
			default:
				break;
		}
	}
	this.stream.subscribe(this.collisionCounter.bind(this));


	this.infectionCounter = function(action) {
		switch(action) {
			case "init":
				this.state.infections.addInfection(this.state.ticks, this.state.sick);
				break;
			case "infection":
				this.state.sick++;
				this.state.infections.addInfection(this.state.ticks, this.state.sick);
				break;
			case "immune":
			case "death":
				this.state.sick--;
				this.state.infections.addInfection(this.state.ticks, this.state.sick);
				break;
			default:
				break;
		}
		this.state.graph.refresh([this.state.infections.data], [color]);
	}
	this.stream.subscribe(this.infectionCounter.bind(this));

	this.getDeathProb = function() {
		if(this.state.sick > this.criticalValue) {
			return this.deathProb+0.20;
		}
		else {
			return this.deathProb;
		}
	}

	this.numOfPeople = 50;
	this.people = [];
	for(let i = 0; i < this.numOfPeople; i++) {
		let person = new Person(maybeHappen(this.moveProb), this.getDeathProb.bind(this), this.x, this.y, this.width, this.height);
		person.stream.subscribe(this.stream.dispatch.bind(this.stream));
		this.people.push(person);
	}

	this.people[0].sick = true;

		
	this.areColliding = function(p1, p2) {
		return (getDistance(p1.x-p2.x, p1.y-p2.y) <= p1.radius);
	}

	this.updateCollidingWith = function(person, people) {
		let collidingWith = [];
		person.collidingWith.forEach(index => {
			if(this.areColliding(person, people[index])) {
				collidingWith.push(index);
			}
		});
		person.collidingWith = collidingWith;
	};	

	this.spreadDisease = function(people) {
		for(let i = 0; i < people.length; i++) {
			let infected = people[i];
			this.updateCollidingWith(infected, people);
			if(!infected.sick) {
				continue;
			}
			for(let j = 0; j < people.length; j++) {
				let person = people[j];

				if(i == j || person.sick || person.immune || person.dead || person.collidingWith.includes(i)) {
					continue;
				}

				if(this.areColliding(infected, person)) {
					this.stream.dispatch("collision");
					person.collidingWith.push(i);
					person.sick = maybeHappen(this.infectionProb);
					if(person.sick) {
						this.stream.dispatch("infection");
					}
				}
			}
		}
	}

	this.draw = function() {
		this.people.forEach(person => person.update());
		this.spreadDisease(this.people);
		this.people.forEach(person => person.draw());
		this.state.graph.draw();
		this.stream.dispatch("tick");
		if(this.state.ticks == 1) {
			this.stream.dispatch("init");
		}
	}
}

function Graph(x, y, length, criticalHeights) {
	this.axisThickness = 1;
	this.axisLength = length;
	this.originX = x;
	this.originY = y;
	this.scaleX = 1;
	this.scaleY = 1;
	this.pointRadius = 3;
	this.datasets = [];
	this.colors = [];
	this.criticalHeights = criticalHeights;
	this.calculateScale = function() {
		let maxY = 0;
		let maxX = 0;
		this.datasets.forEach(data => {
			for(let[x, y] of Object.entries(data)) {
				if(Number(y) > maxY) {
					maxY = y;
				}
				if(Number(x) > maxX) {
					maxX = x;
				}
			}
		});
		this.scaleX = this.axisLength/maxX;
		this.scaleY = this.axisLength/maxY;
	};
	this.draw = function() {
		//x-axis
		ctx.beginPath()
		ctx.fillStyle = "#000000"
		ctx.fillRect(this.originX,this.originY,this.axisLength,this.axisThickness);

		//y-axis
		ctx.beginPath()
		ctx.fillStyle = "#000000"
		ctx.fillRect(this.originX,this.originY,this.axisThickness,-this.axisLength);

		ctx.beginPath()
		ctx.fillStyle = "#cc0000"
		criticalHeights.forEach(height => {
			if(this.originY-height*this.scaleY >= this.originY-this.axisLength) {
				ctx.fillRect(this.originX,this.originY-height*this.scaleY,this.axisLength,this.axisThickness)
			}
		});

		function drawPoint(x, y, radius, color) {
			ctx.beginPath();
			ctx.fillStyle = color; 
			ctx.arc(x,y,radius,0,Math.PI*2);
			ctx.fill();
		}
		
		let i = 0
		this.datasets.forEach(data => {
			let color = this.colors[i];
			for(let [x, y] of Object.entries(data)) {
				drawPoint(Number(x)*this.scaleX+this.originX,-Number(y)*this.scaleY+this.originY,this.pointRadius, color);	
			}
			i++;
		});
	};
	this.refresh = function(datasets, colors) {
		this.datasets = datasets;
		this.colors = colors;
		this.calculateScale();
		this.draw();
	};
}

function Person(isMoving, getDeathProb, simX, simY, simWidth, simHeight) {
	this.isMoving = isMoving;
	this.getDeathProb = getDeathProb;
	this.simX = simX;
	this.simY = simY;
	this.simWidth = simWidth;
	this.simHeight = simHeight;
	this.stream = new Stream();
	this.sick = false;
	this.sickTicks = 0;
	this.sicknessDuration = 60;
	this.immune = false;
	this.dead = false;
	this.collidingWith = [];
	this.x = getRandomRange(this.simX, this.simX+this.simWidth);
	this.y = getRandomRange(this.simY, this.simY+this.simHeight);
	this.speed = 2;
	this.velX = getRandom(this.speed);
	this.velY = getLeg(this.speed, this.velX);
	this.radius = 5;
	this.update = function() {
		if(this.dead) {
			return;
		}
		if(this.sick) {
			this.sickTicks++;
		}

		if(this.sick && this.sickTicks > this.sicknessDuration*100) {
			this.sick = false;
			if(maybeHappen(this.getDeathProb())) {
				this.dead = true;
				this.stream.dispatch("death");
			}
			else {
				this.immune = true;
				this.stream.dispatch("immune");
			}
		}
		
		if(!this.isMoving) {
			return;
		}

		this.x += this.velX;
		this.y += this.velY;
	
		if(this.x < this.simX) {
			this.x = this.simX;
			this.velX = -this.velX;
		}
		if(this.x + this.radius > this.simX+this.simWidth) {
			this.x = this.simX+this.simWidth-this.radius;
			this.velX = -this.velX;
		}
		if(this.y < this.simY) {
			this.y = this.simY;
			this.velY = -this.velY;
		}
		if(this.y + this.radius > this.simY+this.simHeight) {
			this.y = this.simY+this.simHeight-this.radius;
			this.velY = -this.velY;
		}
	};
	this.draw = function() {
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
		ctx.fillStyle = "#00F";
		if(this.sick) {
			ctx.fillStyle = "#FF0000";
		}
		if(this.immune) {
			ctx.fillStyle = "#4CBB17";
		}
		if(this.dead) {
			ctx.fillStyle = "#000000";
		}
		ctx.fill();
		ctx.closePath();
	}
}
function InfectionData() {
	this.data = {};
	this.addInfection = function(tick, sick) {
		this.data[tick] = sick;
	};
}
