const evtSource = new EventSource("http://localhost:10201/api/DEBUG-timed-message");

evtSource.onmessage = (alert) => {
    console.log(alert.data)
}
