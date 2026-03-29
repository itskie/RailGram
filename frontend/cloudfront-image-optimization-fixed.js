function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var querystring = request.querystring || '';
    
    var isImage = uri.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    
    if (isImage) {
        if (!querystring.includes('width=')) {
            querystring += (querystring ? '&' : '') + 'width=800';
        }
        
        if (!querystring.includes('quality=')) {
            querystring += (querystring ? '&' : '') + 'quality=80';
        }
        
        if (!querystring.includes('format=')) {
            querystring += (querystring ? '&' : '') + 'format=auto';
        }
        
        request.querystring = querystring;
    }
    
    return request;
}
