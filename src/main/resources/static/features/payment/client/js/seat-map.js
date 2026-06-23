const states = ['success', 'danger', 'danger', 'warning', 'success', 'danger', 'danger', 'danger', 'success', 'danger'];
for (let i = 0; i < 80; i++) {
    const randState = states[Math.floor(Math.random() * states.length)];
    document.write(`<div class="col-auto"><button class="btn btn-${randState} p-0" style="width: 25px; height: 25px; font-size: 8px;">${i + 1}</button></div>`);
    if ((i + 1) % 10 === 0) document.write('</div><div class="row g-2 mb-2">');
}



const options = {
    series: [92.4, 78.5, 65.2],
    chart: {
        height: 250,
        type: 'radialBar',
    },
    plotOptions: {
        radialBar: {
            dataLabels: {
                name: { fontSize: '22px' },
                value: { fontSize: '16px' },
                total: {
                    show: true,
                    label: '총 예매율',
                    formatter: function (w) { return '78.7%' }
                }
            }
        }
    },
    labels: ['VIP지정석', '일반지정석', '스탠딩구역'],
    colors: ['#ff3e1d', '#ffab00', '#71dd37']
};
const chart = new ApexCharts(document.querySelector("#seatStatsChart"), options);
chart.render();