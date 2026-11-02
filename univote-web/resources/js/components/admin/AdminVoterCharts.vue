<template>
    <div class="voter-charts-card">
        <div class="charts-header">
            <div class="title-group">
                <div class="header-badges">
                    <span class="charts-kicker">Interactive Analytics</span>
                    <span class="live-pill">
                        <span class="pulse-dot"></span>
                        Live Dynamic Data
                    </span>
                </div>
                <h3 class="charts-title">Voter Participation Visualizer</h3>
                <p class="charts-subtitle">
                    Dynamically inspect voter participation and turnout across organizations with real-time charts.
                </p>
            </div>

            <div class="controls-toolbar">
                <!-- Chart Type Selector -->
                <div
                    class="segmented-control"
                    role="group"
                    aria-label="Chart Type Selection"
                    @keydown="onSegmentKeydown"
                >
                    <button
                        v-for="opt in chartTypeOptions"
                        :key="opt.value"
                        :id="`chart-type-${opt.value}`"
                        type="button"
                        class="seg-btn"
                        :class="{ active: chartType === opt.value }"
                        :aria-pressed="chartType === opt.value"
                        @click="chartType = opt.value"
                        :title="opt.title"
                    >
                        <svg class="seg-icon" viewBox="0 0 20 20" fill="currentColor" v-html="opt.icon"></svg>
                        <span>{{ opt.label }}</span>
                    </button>
                </div>


                <!-- Universal Scope Filter (Organizations & Courses) -->
                <div class="org-filter">
                    <label for="focusOrgSelect" class="filter-label">Filter by scope:</label>
                    <select id="focusOrgSelect" v-model="selectedFilter" class="form-select">
                        <option value="all">All Organizations ({{ validOrganizations.length }})</option>
                        <option value="general">Campus-wide / General</option>
                        
                        <optgroup v-if="validOrganizations.length" label="Organizations">
                            <option
                                v-for="org in validOrganizations"
                                :key="org.id ?? 'unassigned'"
                                :value="org.id ?? 'unassigned'"
                            >
                                {{ org.name }} ({{ org.code }})
                            </option>
                        </optgroup>

                        <optgroup v-if="validCourses.length" label="Courses">
                            <option
                                v-for="course in validCourses"
                                :key="course.id"
                                :value="`course:${course.id}`"
                            >
                                {{ course.code }}<template v-if="course.name && course.name !== course.code"> ({{ course.name }})</template>
                            </option>
                        </optgroup>
                    </select>
                </div>

                <!-- Export Chart Actions (SVG + PNG) -->
                <div class="export-group">
                    <button
                        type="button"
                        class="chart-export-btn"
                        @click="exportChartSVG"
                        title="Export current chart as vector SVG"
                    >
                        <svg class="export-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        <span>SVG</span>
                    </button>
                    <button
                        type="button"
                        class="chart-export-btn"
                        @click="exportChartPNG"
                        title="Export current chart as PNG image"
                    >
                        <svg class="export-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                        </svg>
                        <span>PNG</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Quick Summary Pills Bar -->
        <div class="summary-chips-bar" v-if="validOrganizations.length || validCourses.length">
            <div class="chip-item">
                <span class="chip-label">Scope:</span>
                <strong class="chip-val">{{ currentFocusName }}</strong>
            </div>
            <div class="chip-item">
                <span class="chip-label">Total Registered:</span>
                <strong class="chip-val">{{ summaryMetrics.totalVoters }}</strong>
            </div>
            <div class="chip-item chip-highlight">
                <span class="chip-label">Voted:</span>
                <strong class="chip-val">{{ summaryMetrics.voted }} ({{ summaryMetrics.turnoutPct }}%)</strong>
            </div>
            <div class="chip-item">
                <span class="chip-label">Pending Votes:</span>
                <strong class="chip-val">{{ summaryMetrics.notVoted }}</strong>
            </div>

        </div>

        <!-- Dynamic Chart Stage -->
        <div class="chart-stage" ref="chartStage">
            <!-- Loading Skeleton -->
            <div v-if="loading" class="skeleton-wrap">
                <div class="skeleton skeleton-chart"></div>
                <div class="skeleton skeleton-legend"></div>
            </div>

            <!-- Empty State -->
            <div v-else-if="!validOrganizations.length && !validCourses.length" class="empty-chart">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
                </svg>
                <p class="empty-title">No voter data available</p>
                <p class="empty-sub">Voter statistics will appear here once organizations or courses register voters.</p>
            </div>

            <!-- 1. GROUPED BAR CHART -->
            <div v-else-if="chartType === 'bar'" class="chart-wrapper">
                <svg
                    class="chart-svg"
                    :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                    :style="{ minWidth: chartWidth > 760 ? chartWidth + 'px' : '100%' }"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <linearGradient
                            v-for="item in visibleLegendItems"
                            :key="'grad-bar-' + item.key"
                            :id="`barGrad-${item.key}`"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" :stop-color="lighten(item.color, 24)" />
                            <stop offset="100%" :stop-color="item.color" />
                        </linearGradient>
                    </defs>

                    <!-- Background gridlines & Y-axis labels -->
                    <g class="grid-lines">
                        <line
                            v-for="tick in barYAxisTicks"
                            :key="tick.value"
                            :x1="margin.left"
                            :y1="tick.y"
                            :x2="chartWidth - margin.right"
                            :y2="tick.y"
                            stroke="#e9ecef"
                            stroke-dasharray="3,3"
                        />
                        <text
                            v-for="tick in barYAxisTicks"
                            :key="'lbl-' + tick.value"
                            :x="margin.left - 10"
                            :y="tick.y + 4"
                            text-anchor="end"
                            class="axis-text"
                        >
                            {{ formatTick(tick.value) }}
                        </text>
                    </g>

                    <!-- Baseline Axis -->
                    <line
                        :x1="margin.left"
                        :y1="baselineY"
                        :x2="chartWidth - margin.right"
                        :y2="baselineY"
                        stroke="#cdd8cf"
                        stroke-width="1.5"
                    />

                    <!-- Grouped Bars per Organization -->
                    <g
                        v-for="(group, gIdx) in barGroups"
                        :key="group.org.id ?? gIdx"
                        class="bar-group"
                    >
                        <g
                            v-for="(bar, sIdx) in group.bars"
                            :key="bar.key"
                            class="bar-g"
                            :style="{ animationDelay: `${(gIdx * visibleLegendItems.length + sIdx) * 35}ms` }"
                        >
                            <rect
                                class="bar-rect"
                                :x="bar.x"
                                :y="bar.y"
                                :width="bar.width"
                                :height="bar.height"
                                :fill="`url(#barGrad-${bar.key})`"
                                rx="3"
                                @mouseenter="setHoverTooltip($event, `${group.org.name} (${group.org.code})`, bar.label, bar.value, group.org.total_voters ? Math.round((bar.value / group.org.total_voters) * 100) : 0)"
                                @mousemove="moveTooltip($event)"
                                @mouseleave="clearTooltip"
                            />
                            <text
                                v-if="bar.height > 16"
                                class="bar-value-label"
                                :x="bar.x + bar.width / 2"
                                :y="bar.y - 5"
                                text-anchor="middle"
                            >
                                {{ bar.value }}
                            </text>
                        </g>

                        <!-- X-Axis Organization Label -->
                        <text
                            :x="group.centerX"
                            :y="chartHeight - 16"
                            text-anchor="middle"
                            class="org-axis-label"
                            :title="group.org.name"
                        >
                            {{ group.org.code }}
                        </text>
                    </g>
                </svg>
            </div>

            <!-- 2. STACKED BAR CHART -->
            <div v-else-if="chartType === 'stacked'" class="chart-wrapper">
                <svg
                    class="chart-svg"
                    :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                    :style="{ minWidth: chartWidth > 760 ? chartWidth + 'px' : '100%' }"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <linearGradient
                            v-for="item in visibleLegendItems"
                            :key="'grad-stack-' + item.key"
                            :id="`stackGrad-${item.key}`"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" :stop-color="lighten(item.color, 18)" />
                            <stop offset="100%" :stop-color="item.color" />
                        </linearGradient>
                    </defs>

                    <!-- Background gridlines & Y-axis labels -->
                    <g class="grid-lines">
                        <line
                            v-for="tick in stackedYAxisTicks"
                            :key="tick.value"
                            :x1="margin.left"
                            :y1="tick.y"
                            :x2="chartWidth - margin.right"
                            :y2="tick.y"
                            stroke="#e9ecef"
                            stroke-dasharray="3,3"
                        />
                        <text
                            v-for="tick in stackedYAxisTicks"
                            :key="'lbl-' + tick.value"
                            :x="margin.left - 10"
                            :y="tick.y + 4"
                            text-anchor="end"
                            class="axis-text"
                        >
                            {{ formatTick(tick.value) }}
                        </text>
                    </g>

                    <!-- Baseline Axis -->
                    <line
                        :x1="margin.left"
                        :y1="baselineY"
                        :x2="chartWidth - margin.right"
                        :y2="baselineY"
                        stroke="#cdd8cf"
                        stroke-width="1.5"
                    />

                    <!-- Stacked Bars per Organization -->
                    <g
                        v-for="(stack, sIdx) in stackedBars"
                        :key="stack.org.id ?? sIdx"
                        class="bar-group"
                    >
                        <!-- Segments from bottom to top -->
                        <g
                            v-for="(seg, segIdx) in stack.segments"
                            :key="seg.key"
                            class="bar-g"
                            :style="{ animationDelay: `${(sIdx * 4 + segIdx) * 35}ms` }"
                        >
                            <rect
                                class="bar-rect stacked-rect"
                                :x="seg.x"
                                :y="seg.y"
                                :width="seg.width"
                                :height="seg.height"
                                :fill="`url(#stackGrad-${seg.key})`"
                                :rx="seg.isTop ? 4 : 0"
                                @mouseenter="setHoverTooltip($event, `${stack.org.name} (${stack.org.code})`, seg.label, seg.value, stack.org.total_voters ? Math.round((seg.value / stack.org.total_voters) * 100) : 0)"
                                @mousemove="moveTooltip($event)"
                                @mouseleave="clearTooltip"
                            />
                            <text
                                v-if="seg.height > 18"
                                class="stacked-inner-label"
                                :x="seg.x + seg.width / 2"
                                :y="seg.y + seg.height / 2 + 4"
                                text-anchor="middle"
                            >
                                {{ seg.value }}
                            </text>
                        </g>

                        <!-- Total Label on top of stack -->
                        <text
                            v-if="stack.totalValue > 0"
                            class="bar-value-label"
                            :x="stack.centerX"
                            :y="stack.topY - 6"
                            text-anchor="middle"
                        >
                            {{ stack.totalValue }}
                        </text>

                        <!-- X-Axis Organization Label -->
                        <text
                            :x="stack.centerX"
                            :y="chartHeight - 16"
                            text-anchor="middle"
                            class="org-axis-label"
                            :title="stack.org.name"
                        >
                            {{ stack.org.code }}
                        </text>
                    </g>
                </svg>
            </div>

            <!-- 3. DOUGHNUT / PIE CHART -->
            <div v-else-if="chartType === 'doughnut' || chartType === 'pie'" class="circular-chart-layout">
                <div class="single-circular-container">
                    <div class="pie-svg-container">
                        <svg class="circular-svg" viewBox="-160 -160 320 320">
                            <defs>
                                <filter id="slice-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.14" />
                                </filter>
                            </defs>

                            <g v-if="singleModeSlices.length > 0" class="slices-group">
                                <path
                                    v-for="(slice, idx) in singleModeSlices"
                                    :key="slice.key"
                                    :d="slice.pathD"
                                    :fill="slice.color"
                                    class="pie-slice"
                                    :class="{ 'slice-exploded': hoveredSlice === slice.key }"
                                    :style="{
                                        transform: hoveredSlice === slice.key ? `translate(${slice.explodeDx}px, ${slice.explodeDy}px)` : 'translate(0,0)',
                                        animationDelay: `${idx * 60}ms`,
                                    }"
                                    @mouseenter="hoveredSlice = slice.key; setHoverTooltip($event, currentFocusName, slice.label, slice.value, slice.percentage)"
                                    @mousemove="moveTooltip($event)"
                                    @mouseleave="hoveredSlice = null; clearTooltip()"
                                />
                                <!-- Percentage label for large slices -->
                                <text
                                    v-for="slice in singleModeSlices.filter(s => s.percentage >= 8 && !s.isFullCircle)"
                                    :key="'lbl-' + slice.key"
                                    :x="slice.labelX"
                                    :y="slice.labelY"
                                    text-anchor="middle"
                                    class="slice-percent-label"
                                >
                                    {{ slice.percentage }}%
                                </text>
                            </g>

                            <!-- Placeholder when no slices exist -->
                            <g v-else>
                                <circle cx="0" cy="0" r="130" fill="#f8faf8" stroke="#dce5de" stroke-dasharray="4,4" />
                                <text y="4" text-anchor="middle" class="empty-donut-txt">No Voters Recorded</text>
                            </g>

                            <!-- Center text for Doughnut Chart -->
                            <g v-if="chartType === 'doughnut'" class="doughnut-center-info">
                                <circle cx="0" cy="0" r="68" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))" />
                                <text y="-8" text-anchor="middle" class="donut-center-val">{{ summaryMetrics.totalVoters }}</text>
                                <text y="14" text-anchor="middle" class="donut-center-lbl">Total Voters</text>
                            </g>
                        </svg>
                    </div>

                    <div class="slices-breakdown">
                        <div class="breakdown-header-card">
                            <span class="breakdown-tag">Detailed Breakdown</span>
                            <h4 class="breakdown-title">{{ currentFocusName }}</h4>
                            <p class="breakdown-meta">
                                Total Voters: <strong>{{ summaryMetrics.totalVoters }}</strong>
                                <span v-if="summaryMetrics.totalVoters > 0"> · Turnout: <strong>{{ summaryMetrics.turnoutPct }}%</strong></span>
                            </p>
                        </div>

                        <div class="slices-list" v-if="singleModeSlices.length > 0">
                            <div
                                v-for="slice in singleModeSlices"
                                :key="slice.key"
                                class="slice-item"
                                :class="{ 'slice-item-hover': hoveredSlice === slice.key }"
                                @mouseenter="hoveredSlice = slice.key"
                                @mouseleave="hoveredSlice = null"
                            >
                                <span class="slice-dot" :style="{ backgroundColor: slice.color }"></span>
                                <div class="slice-texts">
                                    <span class="slice-name">{{ slice.label }}</span>
                                    <span class="slice-stats"><strong>{{ slice.value }}</strong> ({{ slice.percentage }}%)</span>
                                </div>
                            </div>
                        </div>
                        <div v-else class="empty-slices-note">
                            No active data for the selected series. Click hidden items in the legend below to show them.
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. LINE / AREA CHART -->
            <div v-else-if="chartType === 'line'" class="chart-wrapper">
                <svg
                    class="chart-svg"
                    :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                    :style="{ minWidth: chartWidth > 760 ? chartWidth + 'px' : '100%' }"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <linearGradient
                            v-for="item in visibleLegendItems"
                            :key="'grad-line-' + item.key"
                            :id="`lineGrad-${item.key}`"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" :stop-color="item.color" stop-opacity="0.25" />
                            <stop offset="100%" :stop-color="item.color" stop-opacity="0.01" />
                        </linearGradient>
                    </defs>

                    <!-- Background gridlines & Y-axis labels -->
                    <g class="grid-lines">
                        <line
                            v-for="tick in barYAxisTicks"
                            :key="tick.value"
                            :x1="margin.left"
                            :y1="tick.y"
                            :x2="chartWidth - margin.right"
                            :y2="tick.y"
                            stroke="#e9ecef"
                            stroke-dasharray="3,3"
                        />
                        <text
                            v-for="tick in barYAxisTicks"
                            :key="'lbl-' + tick.value"
                            :x="margin.left - 10"
                            :y="tick.y + 4"
                            text-anchor="end"
                            class="axis-text"
                        >
                            {{ formatTick(tick.value) }}
                        </text>
                    </g>

                    <!-- Baseline Axis -->
                    <line
                        :x1="margin.left"
                        :y1="baselineY"
                        :x2="chartWidth - margin.right"
                        :y2="baselineY"
                        stroke="#cdd8cf"
                        stroke-width="1.5"
                    />

                    <!-- Line Series with area and points -->
                    <g v-for="series in lineSeriesList" :key="series.key" class="line-series">
                        <!-- Area Fill -->
                        <path
                            v-if="series.points.length > 1 && series.areaD"
                            :d="series.areaD"
                            :fill="`url(#lineGrad-${series.key})`"
                            class="line-area"
                        />

                        <!-- Stroke Path (when 2+ points) -->
                        <path
                            v-if="series.points.length > 1"
                            class="line-path"
                            :d="series.pathD"
                            fill="none"
                            :stroke="series.color"
                            stroke-width="3"
                            stroke-linejoin="round"
                            stroke-linecap="round"
                        />

                        <!-- Single Point Vertical Dropline when 1 point exists -->
                        <g v-if="series.points.length === 1">
                            <line
                                :x1="series.points[0].x"
                                :y1="baselineY"
                                :x2="series.points[0].x"
                                :y2="series.points[0].y"
                                :stroke="series.color"
                                stroke-width="2"
                                stroke-dasharray="4,3"
                            />
                        </g>

                        <!-- Data Point Markers -->
                        <g v-for="pt in series.points" :key="pt.orgCode + '-' + series.key">
                            <circle
                                :cx="pt.x"
                                :cy="pt.y"
                                r="5.5"
                                :fill="series.color"
                                stroke="#ffffff"
                                stroke-width="2.5"
                                class="line-point"
                                @mouseenter="setHoverTooltip($event, `${pt.orgName} (${pt.orgCode})`, series.label, pt.value, pt.totalVoters ? Math.round((pt.value / pt.totalVoters) * 100) : 0)"
                                @mousemove="moveTooltip($event)"
                                @mouseleave="clearTooltip"
                            />
                            <!-- Value badge above point when 1 or few orgs -->
                            <text
                                v-if="series.points.length <= 4 && pt.value > 0"
                                :x="pt.x"
                                :y="pt.y - 10"
                                text-anchor="middle"
                                class="line-pt-label"
                                :fill="series.color"
                            >
                                {{ pt.value }}
                            </text>
                        </g>
                    </g>

                    <!-- X-Axis Labels -->
                    <text
                        v-for="orgPt in lineXLabels"
                        :key="orgPt.code"
                        :x="orgPt.x"
                        :y="chartHeight - 16"
                        text-anchor="middle"
                        class="org-axis-label"
                    >
                        {{ orgPt.code }}
                    </text>
                </svg>
            </div>

            <!-- Floating Tooltip (Strictly contained within chart-stage) -->
            <div
                ref="chartTooltip"
                v-if="tooltip.visible"
                class="chart-tooltip"
                :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }"
                role="tooltip"
            >
                <strong class="tooltip-title">{{ tooltip.title }}</strong>
                <div class="tooltip-body">
                    <span class="tooltip-metric">{{ tooltip.metric }}:</span>
                    <span class="tooltip-val">{{ tooltip.value }}</span>
                    <span v-if="tooltip.percentage !== null" class="tooltip-pct">({{ tooltip.percentage }}%)</span>
                </div>
            </div>
        </div>

        <!-- Universal Interactive Legend (Click to toggle series on/off) -->
        <footer class="chart-legend" aria-label="Chart Series Legend — click to toggle">
            <button
                v-for="item in allLegendItems"
                :key="item.key"
                type="button"
                class="legend-item"
                :class="{ 'legend-hidden': isSeriesHidden(item.key) }"
                @click="toggleSeries(item.key)"
                :title="isSeriesHidden(item.key) ? `Show ${item.label}` : `Hide ${item.label}`"
            >
                <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
                <span class="legend-label">{{ item.label }}</span>
                <svg
                    v-if="isSeriesHidden(item.key)"
                    class="legend-off-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <line x1="2" y1="2" x2="14" y2="14" stroke-linecap="round" />
                </svg>
            </button>
        </footer>
    </div>
</template>

<script>
export default {
    name: "AdminVoterCharts",
    props: {
        organizationStats: {
            type: Array,
            default: () => [],
        },
        courseStats: {
            type: Array,
            default: () => [],
        },
        loading: {
            type: Boolean,
            default: false,
        },
        // Filter pushed down by the dashboard "Filter by scope" dropdown.
        scopedFilter: {
            type: [Number, String],
            default: "all",
        },
    },
    data() {
        return {
            chartType: "bar", // bar, stacked, doughnut, pie, line
            metricMode: "participation", // participation, demographics, both
            selectedFilter: "all",
            hoveredSlice: null,
            hiddenSeries: new Set(),
            margin: { top: 32, right: 30, bottom: 46, left: 52 },
            baseChartWidth: 780,
            chartHeight: 330,
            tooltip: {
                visible: false,
                x: 0,
                y: 0,
                title: "",
                metric: "",
                value: 0,
                percentage: null,
            },
            palette: {
                total_voters:  { key: "total_voters",  label: "Total Voters",  color: "#146c3a" },
                voted:         { key: "voted",         label: "Voted",         color: "#10b981" },
                not_voted:     { key: "not_voted",     label: "Not Voted",     color: "#f59e0b" },
            },
            chartTypeOptions: [
                {
                    value: "bar",
                    label: "Bar",
                    title: "Grouped Bar Chart",
                    icon: '<path d="M2 11h3v7H2v-7zm6-5h3v12H8V6zm6-4h3v16h-3V2z" />',
                },
                {
                    value: "stacked",
                    label: "Stacked",
                    title: "Stacked Bar Chart",
                    icon: '<path d="M3 13h14v4H3v-4zm0-5h14v4H3V8zm0-5h14v4H3V3z" />',
                },
                {
                    value: "doughnut",
                    label: "Doughnut",
                    title: "Doughnut Chart",
                    icon: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />',
                },
                {
                    value: "pie",
                    label: "Pie",
                    title: "Pie Chart",
                    icon: '<path d="M10 2a8 8 0 108 8h-8V2z" /><path d="M12 2.25A8.014 8.014 0 0117.75 8H12V2.25z" />',
                },
                {
                    value: "line",
                    label: "Line",
                    title: "Line / Area Chart",
                    icon: '<path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12h13a1 1 0 110 2H3a1 1 0 01-1-1V4a1 1 0 011-1zm13.707 4.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0L9 10.414l-2.293 2.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0L12 10.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />',
                },
            ],
        };
    },
    computed: {
        validOrganizations() {
            return this.organizationStats || [];
        },
        validCourses() {
            return this.courseStats || [];
        },
        // Filter data based on selection (or all organizations)
        displayOrganizations() {
            const filter = String(this.selectedFilter);
            
            if (filter === "all") {
                return this.validOrganizations;
            }
            
            if (filter === "general") {
                // Show 'Unassigned' if it exists in org stats
                return this.validOrganizations.filter((o) => o.id === null || o.code === 'N/A');
            }
            
            if (filter.startsWith("course:")) {
                const courseId = filter.slice("course:".length);
                return this.validCourses.filter((c) => String(c.id) === courseId);
            }
            
            // Organization filter
            const filtered = this.validOrganizations.filter(
                (o) => (o.id !== null && String(o.id) === filter)
            );
            return filtered.length ? filtered : this.validOrganizations;
        },
        allSeriesKeys() {
            return ["voted", "not_voted", "total_voters"];
        },
        activeSeriesKeys() {
            return this.allSeriesKeys.filter((k) => !this.hiddenSeries.has(k));
        },
        allLegendItems() {
            return this.allSeriesKeys.map((k) => this.palette[k]).filter(Boolean);
        },
        visibleLegendItems() {
            return this.activeSeriesKeys.map((k) => this.palette[k]).filter(Boolean);
        },
        baselineY() {
            return this.chartHeight - this.margin.bottom;
        },
        // Responsive chart width based on number of organizations
        chartWidth() {
            const count = this.displayOrganizations.length;
            if (count <= 3) return this.baseChartWidth;
            const needed = this.margin.left + this.margin.right + count * Math.max(76, this.activeSeriesKeys.length * 20 + 28);
            return Math.max(this.baseChartWidth, needed);
        },
        // Y-axis maximum for Bar and Line charts
        barMaxVal() {
            let max = 5;
            for (const org of this.displayOrganizations) {
                for (const key of this.activeSeriesKeys) {
                    if ((org[key] || 0) > max) {
                        max = org[key] || 0;
                    }
                }
            }
            return this.niceCeil(max * 1.15);
        },
        barYAxisTicks() {
            return this.computeYAxisTicks(this.barMaxVal);
        },
        // Grouped Bar Chart calculations
        barGroups() {
            const orgs = this.displayOrganizations;
            if (!orgs.length) return [];

            const chartAreaWidth = this.chartWidth - this.margin.left - this.margin.right;
            const groupWidth = chartAreaWidth / orgs.length;
            const seriesKeys = this.activeSeriesKeys;
            const barWidth = Math.max(8, Math.min(32, (groupWidth * 0.76) / Math.max(1, seriesKeys.length)));
            const availableHeight = this.baselineY - this.margin.top;

            return orgs.map((org, index) => {
                const groupStartX = this.margin.left + index * groupWidth;
                const centerX = groupStartX + groupWidth / 2;
                const totalBarsWidth = seriesKeys.length * barWidth;
                const startX = centerX - totalBarsWidth / 2;

                const bars = seriesKeys.map((key, sIdx) => {
                    const val = org[key] || 0;
                    const height = (val / this.barMaxVal) * availableHeight;
                    const x = startX + sIdx * barWidth;
                    const y = this.baselineY - height;
                    return {
                        key,
                        x,
                        y,
                        width: Math.max(4, barWidth - 2),
                        height: Math.max(0, height),
                        color: this.palette[key]?.color || "#10b981",
                        label: this.palette[key]?.label || key,
                        value: val,
                    };
                });

                return {
                    org,
                    centerX,
                    bars,
                };
            });
        },
        // Stacked Bar calculations
        stackedMaxVal() {
            let max = 5;
            for (const org of this.displayOrganizations) {
                const stackSum = this.activeSeriesKeys
                    .filter((k) => k !== "total_voters")
                    .reduce((acc, k) => acc + (org[k] || 0), 0);
                if (stackSum > max) max = stackSum;
            }
            return this.niceCeil(max * 1.15);
        },
        stackedYAxisTicks() {
            return this.computeYAxisTicks(this.stackedMaxVal);
        },
        stackedBars() {
            const orgs = this.displayOrganizations;
            if (!orgs.length) return [];

            const chartAreaWidth = this.chartWidth - this.margin.left - this.margin.right;
            const groupWidth = chartAreaWidth / orgs.length;
            const barWidth = Math.max(16, Math.min(48, groupWidth * 0.52));
            const availableHeight = this.baselineY - this.margin.top;
            const keysToStack = this.activeSeriesKeys.filter((k) => k !== "total_voters");

            return orgs.map((org, index) => {
                const groupStartX = this.margin.left + index * groupWidth;
                const centerX = groupStartX + groupWidth / 2;
                const x = centerX - barWidth / 2;

                let currentY = this.baselineY;
                const nonZeroKeys = keysToStack.filter((k) => (org[k] || 0) > 0);
                const segments = [];

                keysToStack.forEach((key) => {
                    const val = org[key] || 0;
                    if (val <= 0) return;
                    const height = (val / this.stackedMaxVal) * availableHeight;
                    const y = currentY - height;
                    const isTop = nonZeroKeys[nonZeroKeys.length - 1] === key;

                    segments.push({
                        key,
                        x,
                        y,
                        width: barWidth,
                        height,
                        isTop,
                        color: this.palette[key]?.color || "#10b981",
                        label: this.palette[key]?.label || key,
                        value: val,
                    });
                    currentY = y;
                });

                const totalVal = segments.reduce((sum, s) => sum + s.value, 0);

                return {
                    org,
                    centerX,
                    topY: currentY,
                    totalValue: totalVal,
                    segments,
                };
            });
        },
        // Line Series calculations
        lineSeriesList() {
            const orgs = this.displayOrganizations;
            if (!orgs.length) return [];

            const chartAreaWidth = this.chartWidth - this.margin.left - this.margin.right;
            const stepX = orgs.length > 1 ? chartAreaWidth / (orgs.length - 1) : chartAreaWidth / 2;
            const availableHeight = this.baselineY - this.margin.top;

            return this.activeSeriesKeys.map((key) => {
                const points = orgs.map((org, idx) => {
                    const x = orgs.length > 1 ? this.margin.left + idx * stepX : this.margin.left + chartAreaWidth / 2;
                    const val = org[key] || 0;
                    const y = this.baselineY - (val / this.barMaxVal) * availableHeight;
                    return {
                        x,
                        y,
                        value: val,
                        orgName: org.name,
                        orgCode: org.code,
                        totalVoters: org.total_voters || 0,
                    };
                });

                const pathD = points.reduce((d, pt, i) => `${d} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");

                let areaD = "";
                if (points.length > 1) {
                    const firstX = points[0].x;
                    const lastX = points[points.length - 1].x;
                    areaD = pathD + ` L ${lastX} ${this.baselineY} L ${firstX} ${this.baselineY} Z`;
                }

                return {
                    key,
                    label: this.palette[key]?.label || key,
                    color: this.palette[key]?.color || "#10b981",
                    points,
                    pathD,
                    areaD,
                };
            });
        },
        lineXLabels() {
            const orgs = this.displayOrganizations;
            if (!orgs.length) return [];

            const chartAreaWidth = this.chartWidth - this.margin.left - this.margin.right;
            const stepX = orgs.length > 1 ? chartAreaWidth / (orgs.length - 1) : chartAreaWidth / 2;

            return orgs.map((org, idx) => ({
                code: org.code,
                x: orgs.length > 1 ? this.margin.left + idx * stepX : this.margin.left + chartAreaWidth / 2,
            }));
        },
        // Data for the currently focused organization, course, or aggregate
        focusedOrgData() {
            const filter = String(this.selectedFilter);
            
            if (filter === "all") {
                const agg = {
                    name: "All Organizations",
                    code: "ALL",
                    total_voters: 0,
                    voted: 0,
                    not_voted: 0,
                    male_voters: 0,
                    female_voters: 0,
                    other_voters: 0,
                };
                for (const org of this.validOrganizations) {
                    agg.total_voters += org.total_voters || 0;
                    agg.voted += org.voted || 0;
                    agg.not_voted += org.not_voted || 0;
                    agg.male_voters += org.male_voters || 0;
                    agg.female_voters += org.female_voters || 0;
                    agg.other_voters += org.other_voters || 0;
                }
                return agg;
            }

            if (filter === "general") {
                return this.validOrganizations.find(o => o.id === null || o.code === 'N/A') || {
                    name: "Campus-wide",
                    code: "GEN",
                    total_voters: 0,
                    voted: 0,
                    not_voted: 0,
                    male_voters: 0,
                    female_voters: 0,
                    other_voters: 0,
                };
            }

            if (filter.startsWith("course:")) {
                const id = filter.slice("course:".length);
                return (
                    this.validCourses.find((c) => String(c.id) === id) || {
                        name: "Unknown Course",
                        code: "N/A",
                        total_voters: 0,
                        voted: 0,
                        not_voted: 0,
                        male_voters: 0,
                        female_voters: 0,
                        other_voters: 0,
                    }
                );
            }

            return (
                this.validOrganizations.find(
                    (o) => o.id !== null && String(o.id) === filter
                ) || {
                    name: "Unknown",
                    code: "N/A",
                    total_voters: 0,
                    voted: 0,
                    not_voted: 0,
                    male_voters: 0,
                    female_voters: 0,
                    other_voters: 0,
                }
            );
        },
        currentFocusName() {
            return this.focusedOrgData.name;
        },
        summaryMetrics() {
            const d = this.focusedOrgData;
            const total = d.total_voters || 0;
            const voted = d.voted || 0;
            const notVoted = d.not_voted || 0;
            const turnout = total > 0 ? Math.round((voted / total) * 100) : 0;
            return {
                totalVoters: total,
                voted,
                notVoted,
                turnoutPct: turnout,
            };
        },
        // Slices for Participation (Voted vs Not Voted)
        participationSlices() {
            const data = this.focusedOrgData;
            const raw = [
                { key: "voted", label: "Voted", val: data.voted || 0, color: this.palette.voted.color },
                { key: "not_voted", label: "Not Voted", val: data.not_voted || 0, color: this.palette.not_voted.color },
            ].filter((s) => !this.hiddenSeries.has(s.key));
            return this.buildSvgSlices(raw);
        },
        // Single mode slices for participation
        singleModeSlices() {
            return this.participationSlices;
        },
    },
    watch: {
        chartType() {
            this.hoveredSlice = null;
        },
        // Keep the chart's selection aligned with the dashboard
        // "Filter by scope" dropdown.
        scopedFilter: {
            immediate: true,
            handler(value) {
                this.selectedFilter =
                    value === null || value === undefined || value === ""
                        ? "all"
                        : value;
            },
        },
        organizationStats() {
            this.validateSelection();
        },
        courseStats() {
            this.validateSelection();
        },
    },
    methods: {
        validateSelection() {
            // Verify selected scope still exists in its respective list
            const filter = String(this.selectedFilter);
            if (filter === "all" || filter === "general") return;

            if (filter.startsWith("course:")) {
                const id = filter.slice("course:".length);
                if (!this.validCourses.some(c => String(c.id) === id)) {
                    this.selectedFilter = "all";
                }
            } else {
                if (!this.validOrganizations.some(o => (o.id ?? "unassigned") === filter)) {
                    this.selectedFilter = "all";
                }
            }
        },
        isSeriesHidden(key) {
            return this.hiddenSeries.has(key);
        },
        toggleSeries(key) {
            if (this.activeSeriesKeys.length <= 1 && !this.hiddenSeries.has(key)) {
                return; // Keep at least one active series
            }
            if (this.hiddenSeries.has(key)) {
                this.hiddenSeries.delete(key);
            } else {
                this.hiddenSeries.add(key);
            }
            this.hiddenSeries = new Set(this.hiddenSeries);
        },
        onSegmentKeydown(e) {
            const opts = this.chartTypeOptions;
            const idx = opts.findIndex((o) => o.value === this.chartType);
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                this.chartType = opts[(idx + 1) % opts.length].value;
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                this.chartType = opts[(idx - 1 + opts.length) % opts.length].value;
            }
        },
        niceCeil(value) {
            if (value <= 0) return 5;
            const exponent = Math.floor(Math.log10(value));
            const fraction = value / Math.pow(10, exponent);
            let niceFraction;
            if (fraction <= 1) niceFraction = 1;
            else if (fraction <= 2) niceFraction = 2;
            else if (fraction <= 5) niceFraction = 5;
            else niceFraction = 10;
            return niceFraction * Math.pow(10, exponent);
        },
        computeYAxisTicks(maxVal) {
            const ticks = [];
            const count = 5;
            const step = maxVal / count;
            const availableHeight = this.baselineY - this.margin.top;

            for (let i = 0; i <= count; i++) {
                const val = Math.round(i * step);
                const y = this.baselineY - (val / maxVal) * availableHeight;
                ticks.push({ value: val, y });
            }
            return ticks;
        },
        formatTick(val) {
            if (val >= 1000) {
                return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + "k";
            }
            return String(val);
        },
        lighten(hex, pct) {
            const clean = (hex || "#10b981").replace("#", "");
            const num = parseInt(clean, 16);
            const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(pct * 2.55));
            const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(pct * 2.55));
            const b = Math.min(255, (num & 0xff) + Math.round(pct * 2.55));
            return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
        },
        // Universal robust SVG Slice Builder (with 100% full circle fix)
        buildSvgSlices(items) {
            const total = items.reduce((acc, s) => acc + s.val, 0);
            if (total === 0) return [];

            const isDonut = this.chartType === "doughnut";
            const outerR = 140;
            const innerR = isDonut ? 75 : 0;
            const explodeDist = 12;

            let currentAngle = -Math.PI / 2;
            const result = [];

            for (const item of items) {
                if (item.val <= 0) continue;
                const sliceAngle = (item.val / total) * 2 * Math.PI;
                const endAngle = currentAngle + sliceAngle;
                const isFullCircle = sliceAngle >= 2 * Math.PI - 0.001;

                let pathD = "";
                let labelX = 0;
                let labelY = 0;
                let explodeDx = 0;
                let explodeDy = 0;

                if (isFullCircle) {
                    // Full 360 circle: draw as two complementary half-circle arcs to prevent SVG arc collapse
                    if (isDonut) {
                        pathD = `M 0 ${-outerR} A ${outerR} ${outerR} 0 1 1 0 ${outerR} A ${outerR} ${outerR} 0 1 1 0 ${-outerR} M 0 ${-innerR} A ${innerR} ${innerR} 0 1 0 0 ${innerR} A ${innerR} ${innerR} 0 1 0 0 ${-innerR} Z`;
                    } else {
                        pathD = `M 0 ${-outerR} A ${outerR} ${outerR} 0 1 1 0 ${outerR} A ${outerR} ${outerR} 0 1 1 0 ${-outerR} Z`;
                    }
                    labelX = 0;
                    labelY = isDonut ? -(outerR + innerR) / 2 : 0;
                } else {
                    const x1 = Math.cos(currentAngle) * outerR;
                    const y1 = Math.sin(currentAngle) * outerR;
                    const x2 = Math.cos(endAngle) * outerR;
                    const y2 = Math.sin(endAngle) * outerR;
                    const largeArc = sliceAngle > Math.PI ? 1 : 0;

                    if (isDonut) {
                        const ix1 = Math.cos(endAngle) * innerR;
                        const iy1 = Math.sin(endAngle) * innerR;
                        const ix2 = Math.cos(currentAngle) * innerR;
                        const iy2 = Math.sin(currentAngle) * innerR;
                        pathD = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
                    } else {
                        pathD = `M 0 0 L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    }

                    const midAngle = currentAngle + sliceAngle / 2;
                    const labelR = isDonut ? (outerR + innerR) / 2 : outerR * 0.62;
                    explodeDx = Math.cos(midAngle) * explodeDist;
                    explodeDy = Math.sin(midAngle) * explodeDist;
                    labelX = Math.cos(midAngle) * labelR;
                    labelY = Math.sin(midAngle) * labelR;
                }

                result.push({
                    key: item.key,
                    label: item.label,
                    value: item.val,
                    percentage: Math.round((item.val / total) * 100),
                    color: item.color,
                    pathD,
                    explodeDx,
                    explodeDy,
                    labelX,
                    labelY,
                    isFullCircle,
                });

                currentAngle = endAngle;
            }

            return result;
        },
        // Tooltip Positioning (relative strictly to .chart-stage)
        setHoverTooltip(event, title, metric, value, percentage = null) {
            const stage = this.$refs.chartStage;
            const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 400 };

            let x = event.clientX - stageRect.left;
            let y = event.clientY - stageRect.top - 12;

            this.tooltip = {
                visible: true,
                x: Math.max(70, Math.min(x, stageRect.width - 70)),
                y: Math.max(16, y),
                title,
                metric,
                value,
                percentage,
            };
        },
        moveTooltip(event) {
            if (!this.tooltip.visible) return;
            const stage = this.$refs.chartStage;
            const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 400 };

            let x = event.clientX - stageRect.left;
            let y = event.clientY - stageRect.top - 12;

            this.tooltip.x = Math.max(70, Math.min(x, stageRect.width - 70));
            this.tooltip.y = Math.max(16, y);
        },
        clearTooltip() {
            this.tooltip.visible = false;
        },
        // Export chart as standalone vector SVG
        exportChartSVG() {
            const stage = this.$refs.chartStage;
            if (!stage) return;
            const svg = stage.querySelector("svg");
            if (!svg) return;

            const clonedSvg = svg.cloneNode(true);
            clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

            // Add clean white background if not present
            const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bgRect.setAttribute("width", "100%");
            bgRect.setAttribute("height", "100%");
            bgRect.setAttribute("fill", "#ffffff");
            clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

            const serializer = new XMLSerializer();
            const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(clonedSvg);
            const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const dateStr = new Date().toISOString().split("T")[0];
            link.href = url;
            link.download = `univote_${this.chartType}_${this.metricMode}_${dateStr}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        // Export chart as crisp PNG image
        exportChartPNG() {
            const stage = this.$refs.chartStage;
            if (!stage) return;
            const svg = stage.querySelector("svg");
            if (!svg) return;

            const clonedSvg = svg.cloneNode(true);
            clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

            const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bgRect.setAttribute("width", "100%");
            bgRect.setAttribute("height", "100%");
            bgRect.setAttribute("fill", "#ffffff");
            clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(clonedSvg);
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const scale = 2; // High-res retina scale
                canvas.width = (svg.clientWidth || 800) * scale;
                canvas.height = (svg.clientHeight || 340) * scale;
                const ctx = canvas.getContext("2d");
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0, svg.clientWidth || 800, svg.clientHeight || 340);

                const pngUrl = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                const dateStr = new Date().toISOString().split("T")[0];
                link.href = pngUrl;
                link.download = `univote_${this.chartType}_${this.metricMode}_${dateStr}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        },
    },
};
</script>

<style scoped>
.voter-charts-card {
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.2s ease;
    position: relative;
}
.voter-charts-card:hover {
    box-shadow: 0 4px 16px rgba(20, 108, 58, 0.08);
}

.charts-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid #edf1ed;
    padding-bottom: 16px;
}

.title-group {
    flex: 1 1 280px;
}

.header-badges {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}

.charts-kicker {
    color: #146c3a;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.live-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: #146c3a;
    background: #eaf6ee;
    padding: 2px 8px;
    border-radius: 12px;
}

.pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    animation: pulseGlow 1.8s infinite;
}

.charts-title {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 700;
    color: #17231d;
}

.charts-subtitle {
    margin: 0;
    color: #68756d;
    font-size: 13px;
}

.controls-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

/* Segmented Control */
.segmented-control {
    display: inline-flex;
    background: #f1f5f2;
    border-radius: 8px;
    padding: 3px;
    border: 1px solid #dce5de;
}

.seg-btn {
    border: none;
    background: transparent;
    color: #43544b;
    padding: 6px 11px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
}
.seg-btn:hover {
    color: #146c3a;
}
.seg-btn.active {
    background: #ffffff;
    color: #146c3a;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.seg-btn:focus-visible {
    outline: 2px solid #146c3a;
    outline-offset: 1px;
}

.seg-icon {
    width: 14px;
    height: 14px;
}

.metric-filter,
.org-filter {
    display: flex;
    align-items: center;
    gap: 6px;
}

.filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #68756d;
    white-space: nowrap;
}

.form-select {
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid #cdd8cf;
    border-radius: 6px;
    background: #ffffff;
    color: #17231d;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
}
.form-select:focus {
    border-color: #146c3a;
    box-shadow: 0 0 0 2px rgba(20, 108, 58, 0.15);
}

.export-group {
    display: inline-flex;
    gap: 6px;
}

.chart-export-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 34px;
    padding: 0 10px;
    background: #ffffff;
    border: 1px solid #cdd8cf;
    border-radius: 6px;
    color: #294033;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
}
.chart-export-btn:hover {
    background: #f4f8f5;
    border-color: #146c3a;
    color: #146c3a;
}
.export-icon {
    width: 13px;
    height: 13px;
}

/* Summary Chips Bar */
.summary-chips-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background: #f8faf8;
    border: 1px solid #edf1ed;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 12px;
}
.chip-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #43544b;
    padding: 2px 8px;
    border-radius: 6px;
    background: #ffffff;
    border: 1px solid #e2e8e2;
}
.chip-item.chip-highlight {
    background: #eaf6ee;
    border-color: #bfe3ca;
    color: #146c3a;
}
.chip-item.chip-subtle {
    color: #68756d;
}
.chip-label {
    font-weight: 500;
}
.chip-val {
    font-weight: 750;
}

/* Chart Stage */
.chart-stage {
    position: relative;
    min-height: 330px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
    overflow: visible;
}

.chart-wrapper {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
}

.chart-svg {
    width: 100%;
    height: auto;
    max-height: 330px;
    display: block;
}

.axis-text {
    font-size: 11px;
    fill: #8a968f;
    font-weight: 500;
}

.org-axis-label {
    font-size: 12px;
    fill: #294033;
    font-weight: 700;
}

/* Bars Animation & Styling */
.bar-g {
    transform-origin: center bottom;
    transform-box: fill-box;
    animation: barGrow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.bar-rect {
    transition: filter 0.15s ease, opacity 0.15s ease;
    cursor: pointer;
}
.bar-rect:hover {
    filter: brightness(1.12);
    opacity: 0.95;
}
.stacked-inner-label {
    font-size: 10px;
    font-weight: 800;
    fill: #ffffff;
    pointer-events: none;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.3);
    stroke-width: 0.5;
}
.bar-value-label {
    font-size: 11px;
    font-weight: 700;
    fill: #17231d;
    pointer-events: none;
    animation: fadeInUp 0.4s ease 0.15s both;
}

/* Line Series Styling */
.line-area {
    animation: fadeIn 0.5s ease both;
}
.line-path {
    animation: drawPath 0.8s ease forwards;
}
.line-point {
    cursor: pointer;
    transition: r 0.15s ease, filter 0.15s ease;
    animation: fadeIn 0.3s ease both;
}
.line-point:hover {
    r: 8.5;
    filter: drop-shadow(0 0 5px rgba(20, 108, 58, 0.45));
}
.line-pt-label {
    font-size: 11px;
    font-weight: 800;
    pointer-events: none;
}

/* Circular Layout */
.circular-chart-layout {
    width: 100%;
}

.single-circular-container {
    display: flex;
    align-items: center;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 32px;
}

.pie-svg-container {
    width: 320px;
    height: 320px;
    flex-shrink: 0;
}

.circular-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
}

.pie-slice {
    stroke: #ffffff;
    stroke-width: 2px;
    cursor: pointer;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease;
    transform-origin: 0 0;
    transform-box: fill-box;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
    animation: slicePop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.pie-slice:hover {
    filter: brightness(1.08) drop-shadow(0 4px 8px rgba(20, 108, 58, 0.2));
}

.slice-percent-label {
    font-size: 12px;
    font-weight: 800;
    fill: #ffffff;
    pointer-events: none;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.35);
    stroke-width: 0.8;
}

.empty-donut-txt {
    font-size: 12px;
    font-weight: 600;
    fill: #8a968f;
}

.donut-center-val {
    font-size: 24px;
    font-weight: 800;
    fill: #146c3a;
}
.donut-center-lbl {
    font-size: 10px;
    font-weight: 750;
    fill: #68756d;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.slices-breakdown {
    flex: 1;
    min-width: 260px;
    max-width: 440px;
}

.breakdown-header-card {
    margin-bottom: 14px;
}

.breakdown-tag {
    font-size: 10px;
    font-weight: 800;
    color: #146c3a;
    text-transform: uppercase;
    letter-spacing: 0.07em;
}

.breakdown-title {
    margin: 2px 0;
    font-size: 18px;
    font-weight: 700;
    color: #17231d;
}

.breakdown-meta {
    margin: 0;
    font-size: 13px;
    color: #68756d;
}

.slices-list {
    display: grid;
    gap: 8px;
}

.slice-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: #f8faf8;
    border-radius: 8px;
    border: 1px solid #edf1ed;
    cursor: pointer;
    transition: all 0.15s ease;
}
.slice-item:hover,
.slice-item-hover {
    background: #eef5f0;
    border-color: #b6d6be;
    transform: translateX(3px);
}

.slice-dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
}

.slice-texts {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: 13px;
}

.slice-name {
    color: #43544b;
    font-weight: 600;
}

.slice-stats {
    color: #17231d;
}

.empty-slices-note {
    font-size: 12px;
    color: #8a968f;
    font-style: italic;
    padding: 12px;
    background: #f8faf8;
    border-radius: 6px;
}

/* Dual Donuts View (MetricMode === 'both') */
.dual-circular-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    width: 100%;
}

.dual-circular-card {
    background: #fcfdfc;
    border: 1px solid #edf1ed;
    border-radius: 10px;
    padding: 16px;
    text-align: center;
}

.dual-card-title {
    margin: 0 0 2px 0;
    font-size: 15px;
    font-weight: 700;
    color: #17231d;
}

.dual-card-sub {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: #68756d;
}

.donut-svg-wrap {
    width: 220px;
    height: 220px;
    margin: 0 auto 12px auto;
}

.mini-slices-list {
    display: grid;
    gap: 6px;
    text-align: left;
}

.mini-slice-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 4px 8px;
    background: #ffffff;
    border: 1px solid #edf1ed;
    border-radius: 6px;
}

.mini-slice-row .slice-name {
    flex: 1;
}

.mini-slice-row .slice-val {
    color: #17231d;
}

/* Universal Legend */
.chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding-top: 14px;
    border-top: 1px solid #edf1ed;
}

.legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #43544b;
    background: #f8faf8;
    border: 1px solid #edf1ed;
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.legend-item:hover {
    background: #eef5f0;
    border-color: #b6d6be;
}
.legend-item.legend-hidden {
    opacity: 0.42;
    text-decoration: line-through;
}
.legend-item.legend-hidden .legend-color {
    background: #cdd8cf !important;
}
.legend-item:focus-visible {
    outline: 2px solid #146c3a;
    outline-offset: 1px;
}
.legend-color {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    transition: background 0.15s ease;
}
.legend-off-icon {
    width: 10px;
    height: 10px;
    color: #94a3b8;
}

/* Tooltip (Strict positioning relative to .chart-stage) */
.chart-tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    background: #17231d;
    color: #ffffff;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
    max-width: 240px;
    animation: tooltipIn 0.12s ease;
}
.tooltip-title {
    display: block;
    margin-bottom: 2px;
    font-size: 11px;
    color: #a7f3d0;
}
.tooltip-body {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
}
.tooltip-metric {
    color: #d1d5db;
}
.tooltip-val {
    font-weight: 700;
}
.tooltip-pct {
    color: #6ee7b7;
    font-weight: 600;
}

/* Empty State */
.empty-chart {
    text-align: center;
    color: #68756d;
    padding: 40px 20px;
    animation: fadeIn 0.4s ease;
}
.empty-icon {
    width: 48px;
    height: 48px;
    color: #b6d6be;
    margin-bottom: 12px;
}
.empty-title {
    margin: 0 0 4px;
    font-weight: 700;
    color: #43544b;
    font-size: 15px;
}
.empty-sub {
    margin: 0;
    font-size: 13px;
    color: #8a968f;
}

/* Skeleton */
.skeleton-wrap {
    width: 100%;
    padding: 8px 0;
}
.skeleton {
    background: linear-gradient(90deg, #eef1ef 25%, #f6f8f6 50%, #eef1ef 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease infinite;
    border-radius: 8px;
}
.skeleton-chart {
    height: 280px;
    width: 100%;
    margin-bottom: 16px;
}
.skeleton-legend {
    height: 22px;
    width: 60%;
    margin: 0 auto;
}

/* Animations */
@keyframes barGrow {
    from {
        transform: scaleY(0);
        opacity: 0;
    }
    to {
        transform: scaleY(1);
        opacity: 1;
    }
}
@keyframes slicePop {
    from {
        transform: scale(0);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
@keyframes drawPath {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
@keyframes tooltipIn {
    from {
        opacity: 0;
        transform: translate(-50%, -90%);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -100%);
    }
}
@keyframes shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
@keyframes pulseGlow {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.4;
        transform: scale(1.3);
    }
}

@media (max-width: 768px) {
    .charts-header {
        flex-direction: column;
    }
    .controls-toolbar {
        width: 100%;
    }
    .segmented-control {
        width: 100%;
        overflow-x: auto;
    }
    .pie-svg-container {
        width: 260px;
        height: 260px;
    }
    .donut-svg-wrap {
        width: 180px;
        height: 180px;
    }
}
</style>
