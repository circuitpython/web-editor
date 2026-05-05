import Chart from "chart.js/auto";

let textLineBuffer = "";
let textLine;

// Plotter color palette.
// Plotter background is #777 on dark theme and #ccc on light theme, so colors
// must be readable against mid-gray. Pale tints, gray, and brown are dropped
// for that reason. Picked from the Okabe-Ito + tab10 mid-saturation set;
// reused round-robin if a sketch sends more series than colors.
let defaultColors = [
    '#1f77b4', // blue
    '#ff7f0e', // orange
    '#2ca02c', // green
    '#d62728', // red
    '#9467bd', // purple
    '#e377c2', // pink
    '#17becf', // cyan
    '#bcbd22', // olive
    '#e41a1c', // vivid red
    '#377eb8', // steel blue
    '#4daf4a', // leaf green
    '#984ea3', // violet
];

// Resolve a CSS custom property from :root (or body, for theme overrides)
// at chart-build time. Falls back to the supplied default if the variable
// is unset or empty.
function getCssVar(name, fallback) {
    if (typeof window === 'undefined' || !window.getComputedStyle) {
        return fallback;
    }
    const value = window.getComputedStyle(document.body || document.documentElement)
        .getPropertyValue(name)
        .trim();
    return value || fallback;
}

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

/**
 * Parse an Arduino Serial Plotter style line into an array of
 * { label, value } pairs.
 *
 * The Arduino Serial Plotter accepts values separated by commas, tabs, or
 * spaces, and each value may be prefixed with a label using "label:value".
 * Labels are optional; positional values without a label fall back to their
 * index. Examples that should all parse:
 *   "1,2,3"
 *   "1\t2\t3"
 *   "Temp:23.4,Hum:55.1"
 *   "405nm_F1:123\t425nm_F2:456\tClear:789"
 *
 * @param {string} textLine
 * @returns {Array<{label: (string|null), value: number}>}
 */
function parseLabeledValues(textLine) {
    // Split on commas, tabs, or runs of spaces. Arduino's plotter is lenient
    // about which of these the sketch picks.
    const tokens = textLine.split(/[,\t]|\s+/).filter(t => t.length > 0);
    const parsed = [];
    for (const token of tokens) {
        const colonIdx = token.indexOf(":");
        let label = null;
        let valueText = token;
        if (colonIdx > 0) {
            label = token.substring(0, colonIdx).trim();
            valueText = token.substring(colonIdx + 1).trim();
        }
        const value = parseFloat(valueText);
        parsed.push({ label, value });
    }
    return parsed;
}

/**
 * Find the dataset index that matches the incoming sample.
 *
 * If the sample carries a label, prefer matching against an existing dataset
 * with the same label so labeled series stay on the same line across frames
 * (and across reordering). Without a label, fall back to positional index so
 * legacy unlabeled CSV / list / tuple behaviour is unchanged.
 *
 * @param {object} chartObj
 * @param {{label: (string|null), value: number}} sample
 * @param {number} positionalIndex
 * @returns {number}
 */
function resolveDatasetIndex(chartObj, sample, positionalIndex) {
    if (sample.label) {
        for (let i = 0; i < chartObj.data.datasets.length; i++) {
            if (chartObj.data.datasets[i].label === sample.label) {
                return i;
            }
        }
    }
    return positionalIndex;
}

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

        let samples;

        // handle possible tuple in textLine
        if (textLine.startsWith("(") && textLine.endsWith(")")) {
            let textValues = textLine.substring(1, textLine.length - 1).trim();
            // Python tuples can end with a comma, but JS arrays cannot
            if (textValues.endsWith(",")) {
                textValues = textValues.substring(0, textValues.length - 1);
            }
            textLine = "[" + textValues + "]";
        }

        // handle possible list in textLine
        if (textLine.startsWith("[") && textLine.endsWith("]")) {
            let valuesToPlot;
            try {
                valuesToPlot = JSON.parse(textLine);
            } catch (e) {
                // Not a valid JSON list; skip this line.
                continue;
            }
            samples = valuesToPlot.map(v => ({ label: null, value: parseFloat(v) }));
        } else {
            // Handle CSV / tab-separated / labeled values, matching the
            // Arduino IDE Serial Plotter format. See parseLabeledValues.
            samples = parseLabeledValues(textLine);
        }

        if (samples === undefined || samples.length === 0) {
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

            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];
                if (isNaN(sample.value)) {
                    continue;
                }
                const datasetIndex = resolveDatasetIndex(chartObj, sample, i);
                if (datasetIndex > chartObj.data.datasets.length - 1) {
                    const colorIdx = chartObj.data.datasets.length % defaultColors.length;
                    const curColor = defaultColors[colorIdx];
                    chartObj.data.datasets.push({
                        label: sample.label !== null ? sample.label : datasetIndex.toString(),
                        data: [],
                        borderColor: curColor,
                        backgroundColor: curColor
                    });
                } else if (sample.label && chartObj.data.datasets[datasetIndex].label !== sample.label) {
                    // Upgrade a previously-unlabeled positional dataset to use
                    // the label the sketch is now sending. This lets a sketch
                    // that starts unlabeled and switches to labels stay on the
                    // same series rather than spawning duplicates.
                    chartObj.data.datasets[datasetIndex].label = sample.label;
                }
                chartObj.data.datasets[datasetIndex].data.push(sample.value);
            }

            // Pad any datasets that didn't receive a sample on this frame so
            // x-axis alignment stays consistent across labeled series.
            for (let i = 0; i < chartObj.data.datasets.length; i++) {
                const ds = chartObj.data.datasets[i];
                while (ds.data.length < chartObj.data.labels.length) {
                    ds.data.push(null);
                }
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
        // Filter out nulls used for x-axis padding so they don't break min/max.
        const cleaned = chartObj.data.datasets[i].data.filter(v => v !== null && !isNaN(v));
        allData = allData.concat(cleaned);
    }
    if (allData.length === 0) {
        return;
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
                plugins: {
                    legend: {
                        // Show the legend so labeled series are easy to
                        // identify, matching the Arduino IDE Serial Plotter.
                        display: true,
                        position: 'top',
                        labels: {
                            // Pick a color that contrasts with the current
                            // theme's plotter background (set via
                            // --terminal-text-color in sass/layout/_themes.scss).
                            color: getCssVar('--terminal-text-color', '#ddd')
                        }
                    }
                },
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
