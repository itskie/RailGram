/**
 * CloudFront Function for automatic image optimization
 * Adds width and quality parameters to image requests
 * 
 * Usage: Attach this function to your CloudFront distribution
 * Path pattern: /posts/*, /reels/*, /avatars/*
 */

function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var querystring = request.querystring || '';
    
    // Only process image files
    var isImage = uri.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    
    if (isImage) {
        // Add default width if not specified
        if (!querystring.includes('width=')) {
            querystring += (querystring ? '&' : '') + 'width=800';
        }
        
        // Add default quality if not specified
        if (!querystring.includes('quality=')) {
            querystring += (querystring ? '&' : '') + 'quality=80';
        }
        
        // Add format=auto for WebP/AVIF support
        if (!querystring.includes('format=')) {
            querystring += (querystring ? '&' : '') + 'format=auto';
        }
        
        request.querystring = querystring;
    }
    
    return request;
}
