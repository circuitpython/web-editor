import Chart from "chart.js/auto";

let textLineBuffer = "";
let textLine;

let defaultColors = ['#8888ff', '#ff8888', '#88ff88'];

/**
 * @name LineBreakTransformer
 * Helper to parse the incoming string messages into lines.
 */
class LineBreakTransformer {
    constructor() {
        // A container for holding stream data until a new line.
        this.container = '';
    }

    transform(chunk, linesList) {
        this.container += chunk;
        const lines = this.container.split('\n');
        this.container = lines.pop();
        lines.forEach(line => linesList.push(line));
    }

}

let lineTransformer = new LineBreakTransformer()

export function plotValues(chartObj, serialMessage, bufferSize) {
    /*
    Given a string serialMessage, parse it into the plottable value(s) that
    it contains if any, and plot those values onto the given chartObj. If
    the serialMessage doesn't represent a complete textLine it will be stored
    into a buffer and combined with subsequent serialMessages until a full
    textLine is formed.
     */
    let currentLines = []
    lineTransformer.transform(serialMessage, currentLines)

    for (textLine of currentLines) {

        textLine = textLine.replace("\r", "").replace("\n", "")
        if (textLine.length === 0) {
            continue;
        }

        let valuesToPlot;
        let textValues;

        // handle possible tuple in textLine
        if (textLine.startsWith("(") && textLine.endsWith(")")) {
            textValues = textLine.substring(1, textLine.length - 1).trim();
            // Python tuples can end with a comma, but JS arrays cannot
            if (textValues.endsWith(",")) {
                textValues = textValues.substring(0, textValues.length - 1);
            }
            textLine = "[" + textValues + "]";
            console.log("after tuple conversion: " + textLine);
        }

        // handle possible list in textLine
        if (textLine.startsWith("[") && textLine.endsWith("]")) {
            valuesToPlot = JSON.parse(textLine);
            for (let i = 0; i < valuesToPlot.length; i++) {
                valuesToPlot[i] = parseFloat(valuesToPlot[i])
            }

        } else { // handle possible CSV in textLine
            valuesToPlot = textLine.split(",")
            for (let i = 0; i < valuesToPlot.length; i++) {
                valuesToPlot[i] = parseFloat(valuesToPlot[i])
            }
        }

        if (valuesToPlot === undefined || valuesToPlot.length === 0) {
            continue;
        }

        try {
            while (chartObj.data.labels.length > bufferSize) {
                chartObj.data.labels.shift();
                for (let i = 0; i < chartObj.data.datasets.length; i++) {
                    while (chartObj.data.datasets[i].data.length > bufferSize) {
                        chartObj.data.datasets[i].data.shift();
                    }
                }
            }
            chartObj.data.labels.push("");

            for (let i = 0; i < valuesToPlot.length; i++) {
                if (isNaN(valuesToPlot[i])) {
                    continue;
                }
                if (i > chartObj.data.datasets.length - 1) {
                    let curColor = '#000000';
                    if (i < defaultColors.length) {
                        curColor = defaultColors[i];
                    }
                    chartObj.data.datasets.push({
                        label: i.toString(),
                        data: [],
                        borderColor: curColor,
                        backgroundColor: curColor
                    });
                }
                chartObj.data.datasets[i].data.push(valuesToPlot[i]);
            }

            updatePlotterScales(chartObj);
            chartObj.update();
        } catch (e) {
            console.log("JSON parse error");
            // This line isn't a valid data value
        }
    }
}

function updatePlotterScales(chartObj) {
    /*
    Update the scale of the plotter so that maximum and minimum values are sure
    to be shown within the plotter instead of going outside the visible range.
     */
    let allData = []
    for (let i = 0; i < chartObj.data.datasets.length; i++) {
        allData = allData.concat(chartObj.data.datasets[i].data)
    }
    chartObj.options.scales.y.min = Math.min(...allData) - 10
    chartObj.options.scales.y.max = Math.max(...allData) + 10
}

export async function setupPlotterChart(workflow) {
    /*
    Initialize the plotter chart and configure it.
     */
    let initialData = []
    Chart.defaults.backgroundColor = '#444444';
    Chart.defaults.borderColor = '#000000';
    Chart.defaults.color = '#000000';
    Chart.defaults.aspectRatio = 3/2;
    workflow.plotterChart = new Chart(
        document.getElementById('plotter-canvas'),
        {
            type: 'line',
            options: {
                animation: false,
                scales: {
                    y: {
                        min: -1,
                        max: 1,
                        grid:{
                            color: "#666"
                        },
                        border: {
                            color: "#444"
                        }
                    },
                    x:{
                        grid: {
                            display: true,
                            color: "#666"
                        },
                        border: {
                            color: "#444"
                        }
                    }
                }
            },
            data: {
                labels: initialData.map(row => row.timestamp),
                datasets: [
                    {
                        label: '0',
                        data: initialData.map(row => row.value)
                    }
                ]
            }
        }
    );

    // Set up a listener to respond to user changing the grid choice configuration
    // dropdown
    workflow.plotterGridLines.addEventListener('change', (event) => {
        let gridChoice = event.target.value;
        if (gridChoice === "x"){
            workflow.plotterChart.options.scales.x.grid.display = true;
            workflow.plotterChart.options.scales.y.grid.display = false;
        }else if (gridChoice === "y"){
            workflow.plotterChart.options.scales.y.grid.display = true;
            workflow.plotterChart.options.scales.x.grid.display = false;
        }else if (gridChoice === "both"){
            workflow.plotterChart.options.scales.y.grid.display = true;
            workflow.plotterChart.options.scales.x.grid.display = true;
        }else if (gridChoice === "none"){
            workflow.plotterChart.options.scales.y.grid.display = false;
            workflow.plotterChart.options.scales.x.grid.display = false;
        }
        workflow.plotterChart.update();
    });
}
