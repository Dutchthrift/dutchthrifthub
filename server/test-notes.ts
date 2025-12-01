async function testNotes() {
    try {
        console.log('Fetching debug info...');
        const response = await fetch('http://localhost:5000/api/debug/notes');

        const data = await response.json();
        console.log('Debug Info:', JSON.stringify(data, null, 2));

        // Check for the user's note
        const userNoteId = "88bae5ef-979c-42e9-adc3-70d7d4d83be1";
        const found = data.recentNotes.find((n: any) => n.id === userNoteId);
        console.log(`User note ${userNoteId} found?`, !!found);
        if (found) console.log('User note details:', found);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testNotes();
