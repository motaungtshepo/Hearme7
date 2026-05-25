//UI LOGIC (Expand / Collapse composer) - Kept exactly as you wrote it!
const collapsed   = document.getElementById('post-collapsed');
const expanded    = document.getElementById('post-expanded');
const simpleInput = document.getElementById('post-input-simple');
const openBtn     = document.getElementById('open-composer');
const cancelBtn   = document.getElementById('cancel-post');
const postBtn     = document.getElementById('post-button');
const textarea    = document.getElementById('post-textarea');
const tabBtns     = document.querySelectorAll('.tab-btn');
const postContainer = document.getElementById('post-container');

let postType = 'struggle';

function openComposer() {
  collapsed.style.display = 'none';
  expanded.style.display  = 'block';
  textarea.focus();
}

function closeComposer() {
  expanded.style.display  = 'none';
  collapsed.style.display = 'flex';
  textarea.value = '';
  tabBtns.forEach(b => b.classList.remove('active'));
  tabBtns[0].classList.add('active');
  postType = 'struggle';
  textarea.placeholder = "Share what you're going through... You're not alone.";
}

simpleInput.addEventListener('click', openComposer);
openBtn.addEventListener('click', openComposer);
cancelBtn.addEventListener('click', closeComposer);

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    postType = btn.dataset.type;
    textarea.placeholder = postType === 'struggle'
      ? "Share what you're going through... You're not alone."
      : "Share your win, big or small. Inspire others! 🌟";
  });
});

// DATABASE LOGIC (Connecting to Node.js / MongoDB)

// Get the user's token and ID from local storage
const token = authStorage.get('token');
const currentUserIdentifier = authStorage.get('userIdentifier');

//  If they aren't logged in, kick them back to login
if (!token) {
    alert("you need to be logged in to perfom this function")
    window.location.href = 'login.html';
}

// Set the avatar letter at the top right to match their username
document.querySelector('.user-avatar').textContent = currentUserIdentifier ? currentUserIdentifier.charAt(0).toUpperCase() : 'U';

// Function to fetch all posts from the database when page loads
async function fetchPosts() {
    try {
        const response = await fetch('http://localhost:5000/api/posts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const posts = await response.json();
            renderPosts(posts);
        } else {
            console.error('Failed to fetch posts');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to turn MongoDB data into HTML cards
function renderPosts(posts) {
    postContainer.innerHTML = ''; // Clear loading state
    
    if (posts.length === 0) {
        postContainer.innerHTML = '<p style="text-align:center; color:#666;">No posts yet. Be the first to share!</p>';
        return;
    }

    posts.forEach(post => {
        // Create the card
        const card = document.createElement('div');
        card.className = 'post-card';
        
        // Setup styling based on Struggle vs Success
        const isSuccess = post.postType === 'success';
        const badgeColor = isSuccess ? '#e6f7ef' : '#f5e6fb';
        const badgeTextColor = isSuccess ? '#0d894f' : '#8e24aa';
        const badgeText = isSuccess ? '✨ Success' : 'Struggle';
        
        // Calculate likes
        const likeCount = post.likes ? post.likes.length : 0;
        
        card.innerHTML = `
            <div class="post-header" style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar" style="width: 40px; height: 40px; background: #c881d2; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                        ${post.authorIdentifier.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${post.authorIdentifier}</div>
                        <div style="font-size: 0.8rem; color: #666;">Just now</div>
                    </div>
                </div>
                <div style="background: ${badgeColor}; color: ${badgeTextColor}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; height: fit-content;">
                    ${badgeText}
                </div>
            </div>
            <div class="post-content" style="margin-bottom: 15px; line-height: 1.5;">
                ${post.content}
            </div>
            <div class="post-footer" style="display: flex; gap: 20px; color: #666; font-size: 0.9rem; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="alert('Like route coming next!')">
                    <i data-lucide="heart"></i> ${likeCount}
                </div>
                <div style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <i data-lucide="message-square"></i> ${post.comments ? post.comments.length : 0}
                </div>
            </div>
        `;
        postContainer.appendChild(card);
    });

    // Re-initialize Lucide icons for the newly injected HTML
    lucide.createIcons();
}

// Function to handle clicking the POST button
postBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    postBtn.textContent = 'Posting...';
    postBtn.disabled = true;

    try {
        const response = await fetch('http://localhost:5000/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Show the bouncer our ID
            },
            body: JSON.stringify({
                postType: postType,
                content: text
            })
        });

        if (response.ok) {
            closeComposer();
            fetchPosts(); // Refresh the feed immediately to show the new post
        } else {
            alert('Failed to post. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting post:', error);
    } finally {
        postBtn.textContent = 'Post';
        postBtn.disabled = false;
    }
});

// Load everything when the page opens!
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    fetchPosts();
});