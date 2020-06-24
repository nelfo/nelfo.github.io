class App {
    static previousTicketAmount = 2
    static initialConfig = {
        wagonNumber: '',
        ticketAmount: 1,
        isBus: false,
    }

    storage = new PermanentStorage()
    state = {
        wagonNumber: null,
        ticketAmount: null,
        isBus: null,
        // the fields below are generated for each session
        ticketSeries: [],
        lastEmulationTime: null
    }

    constructor() {}

    initialize(){
        this.configurationScene = document.getElementById('configuration')
        this.emulationScene = document.getElementById('emulation')
        this.ticketTemplate = document.querySelector('#ticket-template').content
        this.ticketContainer = this.emulationScene.querySelector('main.content')

        this.initializeConfigurationScene()
        this.initializeEmulationScene()

        this.config = Object.assign({}, App.initialConfig)
        // read previous state
        // and restore emulation if not null
        const state = this.storage.getState()
        if (state) {
            this.state = state
            this.makeSceneActive(this.emulationScene)
            this.emulate(state)
        }
        // change inputs of the configuration form
        this.applyConfig(state ? state : this.config)
    }

    initializeConfigurationScene() {
        const configurationForm = this.configurationScene.querySelector('.configuration-form')
        configurationForm.addEventListener("submit", (event) => {
            event.preventDefault()

            const config = this.readConfig()
            this.state = this.generateState(config)
            this.storage.setState(this.state)
            this.makeSceneActive(this.emulationScene)
            this.emulate(this.state)
        }, false)

        const wagonEl = configurationForm.querySelector('#wagon')
        wagonEl.focus()
    }

    initializeEmulationScene() {
        // Back button behaviour
        const backButton = this.emulationScene.querySelector('.btn.btn--back')
        backButton.addEventListener('click', () => {
            this.makeSceneActive(this.configurationScene)
        }, false)
    }

    applyConfig(config) {
        const configurationForm = this.configurationScene.querySelector('.configuration-form')
        // Set wagon number
        const wagonEl = configurationForm.querySelector('#wagon')
        wagonEl.value = config.wagonNumber
        // Set ticket amount
        configurationForm.querySelector('input[name="tickets"]:checked').checked = false
        configurationForm.querySelector(`input[name="tickets"][value="${config.ticketAmount}"]`).checked = true
        // Set is bus
        configurationForm.querySelector('input[name="bus-switch"]:checked').checked = false
        const switchValue = config.isBus ? 'bus' : 'others'
        configurationForm.querySelector(`input[name="bus-switch"][value="${switchValue}"]`).checked = true
    }

    readConfig() {
        const configurationForm = this.configurationScene.querySelector('.configuration-form')
        return Object.assign({}, App.initialConfig, {
            ticketAmount: parseInt(configurationForm.querySelector('input[name="tickets"]:checked').value),
            wagonNumber: configurationForm.querySelector('#wagon').value,
            isBus: configurationForm.querySelector('input[name="bus-switch"]:checked').value === "bus"
        })
    }

    generateState(config) {
        return Object.assign({}, config, {
            lastEmulationTime: new Date(),
            ticketSeries: this.generateSeries(config.ticketAmount),
        })
    }

    generateSeries(amount = 1) {
        // Real-life series: "954098869, 622075315, 949979459"
        let numbers = []
        for (let i = 0; i < amount; i++) {
            let number
            do {
                number = Utils.random(620000000, 960000000)
            } while (numbers.indexOf(number) !== -1)
            numbers.push(number)
        }
        return numbers
    }

    emulate(state) {
        // Remove all tickets
        while (this.ticketContainer.firstChild) {
            this.ticketContainer.removeChild(this.ticketContainer.firstChild);
        }

        let now = new Date()
        const lastEmulationTime = state.lastEmulationTime ? state.lastEmulationTime : now

        // Initialize current ticket
        this.ticketContainer.appendChild(this.ticketTemplate.cloneNode(true))
        let ticketEl = this.ticketContainer.lastElementChild
        initializeTicket({
            ticketEl: ticketEl,
            time: lastEmulationTime,
            series: state.ticketSeries,
            wagon: state.wagonNumber,
            amount: state.ticketAmount,
            isBus: state.isBus,
            isUsed: lastEmulationTime + (60 * 60 * 1000) > Date.now()
        })
        // Initialize previous tickets
        for (let i = 0; i < App.previousTicketAmount; i++) {
            this.ticketContainer.appendChild(this.ticketTemplate.cloneNode(true))
            let ticketEl = this.ticketContainer.lastElementChild
            let date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - (i + 1),
                Utils.random(8, 22),
                Utils.random(0, 59),
                Utils.random(0, 59))
            let wagonNumber = ['325', '225', '205', '115', '027', '293'][Utils.random(0, 5)]
            const amount = Utils.random(1, 2)
            const series = this.generateSeries(amount)
            initializeTicket({
                ticketEl: ticketEl,
                time: date,
                series: series,
                wagon: wagonNumber,
                amount: amount,
                isBus: false,
                isUsed: true
            })
        }

        function initializeTicket({ticketEl, series, wagon, time, amount, isBus, isUsed}) {
            let seriesEl = ticketEl.querySelector('.ticket__series .series')
            let wagonNumberEl = ticketEl.querySelector('.ticket__wagon .item__value')
            let dateEl = ticketEl.querySelector('.ticket__info > div:nth-child(1) > .item__value')
            let timeEl = ticketEl.querySelector('.ticket__info > div:nth-child(2) > .item__value')
            let amountEl = ticketEl.querySelector('.ticket__info > div:nth-child(3) > .item__value')
            let estimateEl = ticketEl.querySelector('.ticket__estimate .item__value')
            let companyNameEl = ticketEl.querySelector('.ticket__company-name')
            let imageEl = ticketEl.querySelector('.ticket__image > img')
            let transportTypeEl = ticketEl.querySelector('.ticket__wagon > .item > .item__title')

            let dateString = time.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1")
            let timeString = time.toLocaleDateString('en-GB').replace(/\//g, '.')
            dateEl.innerText = `${timeString}`
            timeEl.innerText = `${dateString}`
            seriesEl.innerText = series.join(', ')
            amountEl.innerText = amount + ((amount > 1) ? ' шт' : ' шт')
            wagonNumberEl.innerText = "№" + wagon

            if (isBus) {
                imageEl.setAttribute('src', 'images/ticket-bus.jpg')
                companyNameEl.innerText = "КП Вінницька транспортна компанія автобуси"
                transportTypeEl.innerText = "Автобус"
            }

            if (isUsed) makeUsed()
            else updateEstimateLoop()

            function makeUsed() {
                ticketEl.classList.add('is-used')
                estimateEl.remove()
            }

            function updateEstimateLoop() {
                if (!ticketEl) return
                let now = new Date()
                let diff = 60 * 60 * 1000 - (now - time)
                if (diff < 0) return makeUsed()
                estimateEl.innerText = new Date(diff).toTimeString().replace(/.*(\d{2}:\d{2}).*/, "$1")
                setTimeout(updateEstimateLoop, 1000)
            }
        }

    }

    makeSceneActive(scene) {
        let scenes = document.querySelectorAll('.app > section.scene')
        scenes.forEach(frame => frame.classList.remove('is-active'))
        scene.classList.add('is-active')
    }
}

class PermanentStorage {
    setState(state) {
        localStorage.setItem('wagonNumber', state.wagonNumber)
        localStorage.setItem('lastEmulationTime', state.lastEmulationTime.getTime().toString())
        localStorage.setItem('ticketAmount', state.ticketAmount)
        localStorage.setItem('isBus', state.isBus)
        localStorage.setItem('ticketSeries', JSON.stringify(state.ticketSeries))
    }

    getState() {
        let lastEmulationTime = parseInt(localStorage.getItem('lastEmulationTime'))
        // if the ticket time is up
        if (!lastEmulationTime || (Date.now() >= lastEmulationTime + (60 * 60 * 1000))) {
            this.clearState()
            return null
        }
        return {
            wagonNumber: localStorage.getItem('wagonNumber'),
            isBus: JSON.parse(localStorage.getItem('isBus')),
            ticketAmount: parseInt(localStorage.getItem('ticketAmount')),
            ticketSeries: JSON.parse(localStorage.getItem('ticketSeries')),
            lastEmulationTime: new Date(lastEmulationTime),
        }
    }

    clearState() {
        localStorage.removeItem('wagonNumber')
        localStorage.removeItem('lastEmulationTime')
        localStorage.removeItem('ticketAmount')
        localStorage.removeItem('ticketSeries')
        localStorage.removeItem('isBus')
    }
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
String.prototype.hashCode = function() {
    let hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

const Utils = {
    // from min (inclusive) to max (inclusive)
    random: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    },
    addUrlParameter: function ({param, value}) {
        if(window.location.href.indexOf('?') === -1) {
            window.location.href = window.location.href + '?' + param + '=' + value
        } else if(window.location.href.indexOf(param) === -1) {
            window.location.href = window.location.href + '&' + param + '=' + value
        }
    }
}

let app = new App()
app.initialize()
