export const specimens:Record<string,string>={
JavaScript:`// Import required module
const process = require('process');

class Terminal_Dimensions {
  constructor() {
    this.width = process.stdout.columns;
    this.height = process.stdout.rows;
  }
}

const measure = (start, end) => {
  if (start !== end && end >= 0) {
    return { elapsed: end - start };
  }
};
// -> => === !== <= >= <=> |>`,
HTML:`<!doctype html>
<html lang="en">
  <head><title>Font Zero</title></head>
  <body>
    <!-- Letters in motion -->
    <main class="specimen">
      <h1>Hello, world!</h1>
      <input type="range" />
    </main>
  </body>
</html>`,
CSS:`/* A little room to breathe */
.specimen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  font-weight: 450;
  color: #c4a7e7;
}

.specimen > h1:hover {
  transform: translateY(-2px);
}`,
Java:`import java.util.List;

class TypeSpace {
  public static void main(String[] args) {
    var names = List.of("Kiki", "Booba");
    for (String name : names) {
      if (name.length() >= 4) {
        System.out.println(name);
      }
    }
  }
}`,
Python:`# Curves, all the way down
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

def interpolate(a, b, t):
    if 0 <= t <= 1:
        return a + (b - a) * t
    raise ValueError("Outside the space")

points = [i / 10 for i in range(11)]`,
'C++':`#include <iostream>
#include <vector>

struct Point { float x, y; };

int main() {
  std::vector<Point> points = {{0, 1}};
  for (const auto& p : points) {
    if (p.x <= p.y && p.x != 0) {
      std::cout << p.x << " -> " << p.y;
    }
  }
  return 0;
}`,
PHP:`<?php
// Every letter has a voice.
function blend($a, $b, $t) {
    return $a + ($b - $a) * $t;
}

$names = ['Kiki', 'Booba'];
foreach ($names as $name) {
    if ($name !== null && strlen($name) >= 4) {
        echo "Hello, {$name}!";
    }
}
?>`,
'F#':`// A continuous path through type
let lerp a b t = a + (b - a) * t

let points =
    [0.0 .. 0.1 .. 1.0]
    |> List.map (lerp 0.0 100.0)

let describe value =
    match value with
    | x when x >= 0.5 -> "Booba"
    | _ -> "Kiki"

points |> List.iter (printfn "%f")`
};
export function tokenColors(line:string):string[]{
 const colors=Array(line.length).fill('var(--code-plain)');
 const re=/(\/\/.*|#.*|\/\*.*|<!--.*)|("[^"\n]*"|'[^'\n]*')|\b(const|let|var|class|return|if|else|for|from|import|def|public|static|void|new|function|match|with|struct|int|float|raise|foreach|echo|using)\b|\b\d+(?:\.\d+)?\b|([=<>!&|+*%-]+)/g;
 for(const m of line.matchAll(re)){const c=m[1]?'var(--code-comment)':m[2]?'var(--code-string)':m[3]?'var(--code-keyword)':m[4]?'var(--code-number)':'var(--code-operator)';for(let i=m.index!;i<m.index!+m[0].length;i++)colors[i]=c;}
 return colors;
}
