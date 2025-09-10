const SummaryBoard = (containerName : string,detailIntroduction : string) => {
    return <div id ="summary-board" className="summary-container">
        <div id = "summary-title" className="summary-container">
            <h1 className="container-name">{containerName}</h1>
        </div>
        <div id = "summary-content" className="summary-container">
            <p className="detail-introduction">{detailIntroduction}</p>
        </div>
    </div>;
}

const 

export default SummaryBoard;