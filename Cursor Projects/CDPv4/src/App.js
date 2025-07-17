import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, serverTimestamp, deleteDoc, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// --- Firebase Context ---
const FirebaseContext = createContext(null);

const FirebaseProvider = ({ children }) => {
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [storage, setStorage] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [firebaseInitError, setFirebaseInitError] = useState('');

  useEffect(() => {
    try {
      // Initialize Firebase App from environment variable
      const firebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG) : {};
      if (Object.keys(firebaseConfig).length === 0) {
        setFirebaseInitError("Firebase configuration is missing. Please ensure it's set up correctly.");
        setIsAuthReady(true);
        return;
      }
      const initializedApp = initializeApp(firebaseConfig);
      setApp(initializedApp);
      // Initialize Firebase Services
      const firestoreDb = getFirestore(initializedApp);
      setDb(firestoreDb);
      const firebaseAuth = getAuth(initializedApp);
      setAuth(firebaseAuth);
      const firebaseStorage = getStorage(initializedApp);
      setStorage(firebaseStorage);
      // Set up auth state listener
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(null);
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (error) {
      setFirebaseInitError(`Failed to initialize Firebase: ${error.message}. Please check your Firebase configuration.`);
      setIsAuthReady(true);
    }
  }, []);

  return (
    <FirebaseContext.Provider value={{ app, db, auth, storage, userId, isAuthReady, firebaseInitError }}>
      {children}
    </FirebaseContext.Provider>
  );
};

const useFirebase = () => useContext(FirebaseContext);

// Modal component for messages/alerts
const Modal = ({ message, onClose, onConfirm, showConfirm = false }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center rounded-xl">
        <p className="text-lg mb-4 text-gray-800">{message}</p>
        <div className="flex justify-center space-x-3">
          {showConfirm && (
            <button
              onClick={onConfirm}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-200 shadow-md rounded-lg"
            >
              Confirm
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 shadow-md rounded-lg"
          >
            {showConfirm ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Lightbox Component
const Lightbox = ({ photo, onClose, onNavigate, totalPhotos, currentIndex }) => {
  const { db, userId } = useFirebase();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(photo.likesCount || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db || !photo) return;

    const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
    
    // Listen for comments
    const commentsRef = collection(db, `artifacts/${appId}/public/data/photos/${photo.id}/comments`);
    const unsubscribeComments = onSnapshot(commentsRef, (snapshot) => {
      const fetchedComments = [];
      snapshot.forEach((doc) => {
        fetchedComments.push({ id: doc.id, ...doc.data() });
      });
      fetchedComments.sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
      setComments(fetchedComments);
    });

    // Check if user has liked this photo
    if (userId) {
      const likeRef = doc(db, `artifacts/${appId}/public/data/photos/${photo.id}/likes/${userId}`);
      const unsubscribeLike = onSnapshot(likeRef, (doc) => {
        setIsLiked(doc.exists());
      });
      return () => {
        unsubscribeComments();
        unsubscribeLike();
      };
    }

    return () => unsubscribeComments();
  }, [db, photo, userId]);

  const handleLike = async () => {
    if (!db || !userId) return;

    setLoading(true);
    try {
      const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
      const photoRef = doc(db, `artifacts/${appId}/public/data/photos/${photo.id}`);
      const likeRef = doc(db, `artifacts/${appId}/public/data/photos/${photo.id}/likes/${userId}`);

      if (isLiked) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(photoRef, { likesCount: increment(-1) });
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        // Like
        await setDoc(likeRef, { likedAt: serverTimestamp() });
        await updateDoc(photoRef, { likesCount: increment(1) });
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async () => {
    if (!db || !userId || !newComment.trim()) return;

    setLoading(true);
    try {
      const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
      const commentsRef = collection(db, `artifacts/${appId}/public/data/photos/${photo.id}/comments`);
      await addDoc(commentsRef, {
        text: newComment.trim(),
        commentedBy: userId,
        timestamp: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `hawks-baseball-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold">Photo Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Photo and Details */}
        <div className="p-4">
          <div className="relative">
            <img
              src={photo.url}
              alt={photo.caption || 'Hawks Baseball Photo'}
              className="w-full max-h-96 object-contain rounded-lg"
            />
            
            {/* Navigation Buttons */}
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              disabled={currentIndex === totalPhotos - 1}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>

          {/* Photo Info */}
          <div className="mt-4 space-y-2">
            {photo.caption && (
              <p className="text-lg font-medium text-gray-800">{photo.caption}</p>
            )}
            <p className="text-sm text-gray-600">
              Uploaded by: <span className="font-mono">{photo.uploadedBy.substring(0, 8)}...</span>
            </p>
            {photo.timestamp && (
              <p className="text-sm text-gray-600">
                On: {new Date(photo.timestamp.toDate()).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 mt-4">
            <button
              onClick={handleLike}
              disabled={loading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition duration-200 ${
                isLiked 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
            >
              Download
            </button>
          </div>

          {/* Comments Section */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-lg font-semibold mb-4">Comments</h4>
            
            {/* Add Comment */}
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleComment()}
              />
              <button
                onClick={handleComment}
                disabled={loading || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </button>
            </div>

            {/* Comments List */}
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-800">{comment.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      By: <span className="font-mono">{comment.commentedBy.substring(0, 8)}...</span>
                      {comment.timestamp && (
                        <span className="ml-2">
                          {new Date(comment.timestamp.toDate()).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Authentication Component
const Auth = () => {
  const { auth, userId, isAuthReady } = useFirebase();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  // Simple email validation
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!email || !password) {
      setMessage('Email and password are required.');
      return;
    }
    if (!isValidEmail(email)) {
      setMessage('Please enter a valid email address.');
      return;
    }
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      // Friendly error messages for common Firebase Auth errors
      let friendlyMsg = error.message;
      if (error.code === 'auth/user-not-found') {
        friendlyMsg = 'No user found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        friendlyMsg = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMsg = 'Invalid email address.';
      } else if (error.code === 'auth/email-already-in-use') {
        friendlyMsg = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        friendlyMsg = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/missing-password') {
        friendlyMsg = 'Password is required.';
      }
      setMessage(friendlyMsg);
    }
  };

  const handleSignOut = async () => {
    setMessage('');
    try {
      await signOut(auth);
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
      <Modal message={message} onClose={() => setMessage('')} />
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
          {isLogin ? 'Login' : 'Sign Up'} for Hawks Baseball
        </h2>
        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition duration-300 shadow-md"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p className="text-center text-gray-600 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline font-medium"
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
        {userId && (
          <div className="mt-6 text-center">
            <p className="text-gray-700 text-sm mb-2">Logged in as: <span className="font-mono text-xs bg-gray-200 p-1 rounded">{userId}</span></p>
            <button
              onClick={handleSignOut}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-200"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Player Database
const PLAYERS = [
  { id: '1', name: 'Asher Joslin-White' },
  { id: '2', name: 'Ashton McCarthy' },
  { id: '3', name: 'Brian Aguliar' },
  { id: '4', name: 'Cole Thomas' },
  { id: '5', name: 'Dylan Johnson' },
  { id: '6', name: 'Ethan Heiss' },
  { id: '7', name: 'Hudson Brunton' },
  { id: '8', name: 'Jared Landau' },
  { id: '9', name: 'Matthew Covington' },
  { id: '10', name: 'Maxwell Millay' },
  { id: '11', name: 'Michael Woodruff' },
  { id: '12', name: 'Reed Kleamovich' },
  { id: '13', name: 'Thad Clark' }
];

// Photo Upload Component
const PhotoUpload = ({ onUploadSuccess }) => {
  const { db, storage, userId, isAuthReady } = useFirebase();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const togglePlayer = (player) => {
    setSelectedPlayers(prev => 
      prev.includes(player.name) 
        ? prev.filter(name => name !== player.name)
        : [...prev, player.name]
    );
  };

  const removePlayer = (playerName) => {
    setSelectedPlayers(prev => prev.filter(name => name !== playerName));
  };

  const filteredPlayers = PLAYERS.filter(player =>
    player.name.toLowerCase().includes(playerSearch.toLowerCase()) &&
    !selectedPlayers.includes(player.name)
  );

  const handleUpload = async () => {
    if (!file || !userId || !isAuthReady) {
      setMessage("Please select a file and ensure you are logged in.");
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
      const storageRef = ref(storage, `artifacts/${appId}/public/data/photos/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
      await addDoc(photosCollectionRef, {
        url: downloadURL,
        caption: caption,
        uploadedBy: userId,
        timestamp: serverTimestamp(),
        fileName: fileName,
        likesCount: 0,
        visibility: visibility,
        tags: selectedPlayers,
      });
      setMessage("Photo uploaded successfully!");
      setFile(null);
      setCaption('');
      setVisibility('public');
      setSelectedPlayers([]);
      setPlayerSearch('');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setMessage(`Error uploading photo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 rounded-xl">
      <Modal message={message} onClose={() => setMessage('')} />
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Upload a Photo</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="photoFile" className="block text-gray-700 text-sm font-medium mb-1">Select Image</label>
          <input
            type="file"
            id="photoFile"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-gray-700 border border-gray-300 rounded-lg p-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <div>
          <label htmlFor="caption" className="block text-gray-700 text-sm font-medium mb-1">Caption (Optional)</label>
          <input
            type="text"
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="Add a caption for your photo"
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1">Visibility</label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                className="mr-2"
              />
              <span>Public (visible to all)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="mr-2"
              />
              <span>Private (only you can see)</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1">Players in Photo</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedPlayers.map(playerName => (
              <span key={playerName} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center">
                {playerName}
                <button type="button" className="ml-1 text-blue-500 hover:text-red-500" onClick={() => removePlayer(playerName)}>&times;</button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              onFocus={() => setShowPlayerDropdown(true)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              placeholder="Search and select players..."
            />
            {showPlayerDropdown && filteredPlayers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredPlayers.map(player => (
                  <button
                    key={player.id}
                    type="button"
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                    onClick={() => {
                      togglePlayer(player);
                      setPlayerSearch('');
                      setShowPlayerDropdown(false);
                    }}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className={`w-full py-3 rounded-lg font-semibold text-lg transition duration-300 shadow-md rounded-lg
            ${uploading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
        >
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </button>
      </div>
    </div>
  );
};

// Photo Gallery Component
const PhotoGallery = () => {
  const { db, storage, isAuthReady, userId } = useFirebase();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPhotoForLightbox, setSelectedPhotoForLightbox] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [tagFilter, setTagFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    if (!db || !isAuthReady) return;
    const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
    const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
    const unsubscribe = onSnapshot(photosCollectionRef, (snapshot) => {
      const fetchedPhotos = [];
      snapshot.forEach((doc) => {
        fetchedPhotos.push({ id: doc.id, ...doc.data() });
      });
      fetchedPhotos.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setPhotos(fetchedPhotos);
      setLoading(false);
    }, (error) => {
      setMessage(`Error loading photos: ${error.message}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, isAuthReady]);

  // Filter photos by visibility, tag, and search
  const filteredPhotos = photos.filter(photo => {
    const isOwner = userId && photo.uploadedBy === userId;
    const isVisible = photo.visibility === 'public' || isOwner;
    const tagMatch = !tagFilter || (photo.tags && photo.tags.includes(tagFilter));
    const searchMatch = !searchQuery || 
      (photo.caption && photo.caption.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (photo.tags && photo.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    return isVisible && tagMatch && searchMatch;
  });

  // Collect all unique tags for filter UI
  const allTags = Array.from(new Set(photos.flatMap(photo => photo.tags || [])));

  const togglePhotoSelection = (photoId) => {
    setSelectedPhotos(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const clearSelection = () => {
    setSelectedPhotos([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotos.length === 0) return;

    try {
      const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
      
      for (const photoId of selectedPhotos) {
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          // Delete from Firestore
          const photoDocRef = doc(db, `artifacts/${appId}/public/data/photos/${photoId}`);
          await deleteDoc(photoDocRef);

          // Delete from Storage if fileName exists
          if (photo.fileName) {
            const storageRef = ref(storage, `artifacts/${appId}/public/data/photos/${photo.fileName}`);
            await deleteObject(storageRef);
          }
        }
      }

      setSelectedPhotos([]);
      setMessage(`Successfully deleted ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}.`);
    } catch (error) {
      setMessage(`Error deleting photos: ${error.message}`);
    }
  };

  const openLightbox = (photo, index) => {
    setSelectedPhotoForLightbox(photo);
    setCurrentPhotoIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setSelectedPhotoForLightbox(null);
    setIsLightboxOpen(false);
  };

  const navigateLightbox = (newIndex) => {
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
      setSelectedPhotoForLightbox(filteredPhotos[newIndex]);
      setCurrentPhotoIndex(newIndex);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-xl font-semibold text-gray-700">Loading photos...</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md rounded-xl">
      <Modal message={message} onClose={() => setMessage('')} />
      {showDeleteConfirm && (
        <Modal 
          message={`Are you sure you want to delete ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}? This action cannot be undone.`}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            handleDeleteSelected();
            setShowDeleteConfirm(false);
          }}
          showConfirm={true}
        />
      )}
      {isLightboxOpen && selectedPhotoForLightbox && (
        <Lightbox
          photo={selectedPhotoForLightbox}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
          totalPhotos={filteredPhotos.length}
          currentIndex={currentPhotoIndex}
        />
      )}
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Hawks Baseball Photo Gallery</h3>
      
      {/* Search Bar */}
      <div className="mb-6 relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowSearchDropdown(true)}
          onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
          placeholder="Search photos by caption or player name..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        />
        
        {/* Autocomplete Dropdown */}
        {showSearchDropdown && searchQuery && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {PLAYERS.filter(player => 
              player.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(player => (
              <button
                key={player.id}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 border-b border-gray-100 last:border-b-0"
                onClick={() => {
                  setSearchQuery(player.name);
                  setShowSearchDropdown(false);
                }}
              >
                <div className="flex items-center">
                  <span className="text-blue-600 mr-2">👤</span>
                  <span className="font-medium">{player.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag Filter UI */}
      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="text-gray-700 font-medium mr-2">Filter by player:</span>
          <button
            className={`px-3 py-1 rounded-full text-sm border ${tagFilter === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            onClick={() => setTagFilter('')}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`px-3 py-1 rounded-full text-sm border ${tagFilter === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Selection Controls */}
      {selectedPhotos.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 font-medium">
              {selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-3">
              <button
                onClick={clearSelection}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium transition duration-200"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-200"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredPhotos.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No photos to display. Try uploading or changing the filter!</p>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {filteredPhotos.map((photo, index) => (
            <div 
              key={photo.id} 
              className={`bg-gray-50 rounded-lg shadow-sm overflow-hidden transform hover:scale-105 transition duration-300 relative cursor-pointer break-inside-avoid ${
                selectedPhotos.includes(photo.id) ? 'ring-4 ring-blue-500' : ''
              }`}
            >
              {/* Selection Checkbox */}
              <div 
                className="absolute top-2 left-2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePhotoSelection(photo.id);
                }}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition duration-200 ${
                  selectedPhotos.includes(photo.id) 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}>
                  {selectedPhotos.includes(photo.id) && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <div onClick={() => openLightbox(photo, index)}>
                <img
                  src={photo.url}
                  alt={photo.caption || 'Hawks Baseball Photo'}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x300/e2e8f0/64748b?text=Image+Error"; }}
                />
                <div className="p-4">
                  {photo.caption && (
                    <p className="text-gray-800 font-medium text-sm mb-2">{photo.caption}</p>
                  )}
                  <p className="text-gray-500 text-xs">
                    Uploaded by: <span className="font-mono text-gray-600">{photo.uploadedBy.substring(0, 8)}...</span>
                  </p>
                  {photo.timestamp && (
                    <p className="text-gray-500 text-xs">
                      On: {new Date(photo.timestamp.toDate()).toLocaleDateString()}
                    </p>
                  )}
                  {photo.likesCount > 0 && (
                    <p className="text-gray-500 text-xs mt-1">
                      ❤️ {photo.likesCount} {photo.likesCount === 1 ? 'like' : 'likes'}
                    </p>
                  )}
                  {/* Tags display */}
                  {photo.tags && photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {photo.tags.map(tag => (
                        <span key={tag} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">{tag}</span>
                      ))}
                    </div>
                  )}
                  {/* Visibility display */}
                  {photo.visibility === 'private' && photo.uploadedBy === userId && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-gray-300 text-gray-700 text-xs rounded-full">Private</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Homepage Component - Public Photo Rotation
const Homepage = () => {
  const { db, isAuthReady } = useFirebase();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedPhotoForLightbox, setSelectedPhotoForLightbox] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    if (!db || !isAuthReady) return;
    const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
    const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
    const unsubscribe = onSnapshot(photosCollectionRef, (snapshot) => {
      const fetchedPhotos = [];
      snapshot.forEach((doc) => {
        fetchedPhotos.push({ id: doc.id, ...doc.data() });
      });
      setPhotos(fetchedPhotos);
      setLoading(false);
    }, (error) => {
      setMessage(`Error loading photos: ${error.message}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, isAuthReady]);

  // Rotation logic: prioritize team photos and ensure all players are featured
  const getRotatedPhotos = () => {
    const publicPhotos = photos.filter(photo => photo.visibility === 'public');
    
    if (publicPhotos.length === 0) return [];

    // Collect all unique tags (players)
    const allPlayers = Array.from(new Set(publicPhotos.flatMap(photo => photo.tags || [])));
    
    // Separate team photos (photos with 3+ players) from individual photos
    const teamPhotos = publicPhotos.filter(photo => 
      photo.tags && photo.tags.length >= 3
    );
    const individualPhotos = publicPhotos.filter(photo => 
      photo.tags && photo.tags.length < 3
    );

    // Create rotation: start with team photos, then ensure all players are featured
    let rotatedPhotos = [];
    
    // Add team photos first (prioritize full team)
    if (teamPhotos.length > 0) {
      rotatedPhotos.push(...teamPhotos.slice(0, Math.min(teamPhotos.length, 6)));
    }

    // Add individual photos to ensure all players are featured
    const featuredPlayers = new Set(rotatedPhotos.flatMap(photo => photo.tags || []));
    const remainingPlayers = allPlayers.filter(player => !featuredPlayers.has(player));
    
    // Add photos of remaining players
    remainingPlayers.forEach(player => {
      const playerPhotos = individualPhotos.filter(photo => 
        photo.tags && photo.tags.includes(player)
      );
      if (playerPhotos.length > 0) {
        rotatedPhotos.push(playerPhotos[0]); // Add first photo of each remaining player
      }
    });

    // If we still have space, add more individual photos
    const maxPhotos = 12; // Show max 12 photos on homepage
    if (rotatedPhotos.length < maxPhotos) {
      const usedPhotoIds = new Set(rotatedPhotos.map(p => p.id));
      const additionalPhotos = individualPhotos
        .filter(photo => !usedPhotoIds.has(photo.id))
        .slice(0, maxPhotos - rotatedPhotos.length);
      rotatedPhotos.push(...additionalPhotos);
    }

    // Sort by timestamp (newest first) within the rotation
    return rotatedPhotos.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
  };

  const rotatedPhotos = getRotatedPhotos();

  // Filter photos by search query
  const filteredPhotos = rotatedPhotos.filter(photo => {
    if (!searchQuery) return true;
    return (
      (photo.caption && photo.caption.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (photo.tags && photo.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    );
  });

  const openLightbox = (photo, index) => {
    setSelectedPhotoForLightbox(photo);
    setCurrentPhotoIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setSelectedPhotoForLightbox(null);
    setIsLightboxOpen(false);
  };

  const navigateLightbox = (newIndex) => {
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
      setSelectedPhotoForLightbox(filteredPhotos[newIndex]);
      setCurrentPhotoIndex(newIndex);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-slate-700">Loading awesome photos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-slate-200">
      <Modal message={message} onClose={() => setMessage('')} />
      
      {isLightboxOpen && selectedPhotoForLightbox && (
        <Lightbox
          photo={selectedPhotoForLightbox}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
          totalPhotos={filteredPhotos.length}
          currentIndex={currentPhotoIndex}
        />
      )}
      
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-slate-800 mb-2">Welcome to Hawks Baseball!</h2>
        <div className="flex items-center justify-center space-x-2 text-amber-600">
          <span>🏆</span>
          <span className="text-lg font-medium">Cooperstown Dreams Park 2025</span>
          <span>🏆</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative max-w-2xl mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchDropdown(true)}
            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
            placeholder="🔍 Search photos by caption or player name..."
            className="search-input w-full px-6 py-4 rounded-xl text-lg focus:outline-none transition-all duration-300"
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400">
            🔍
          </div>
          
          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchQuery && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {PLAYERS.filter(player => 
                player.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(player => (
                <button
                  key={player.id}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  onClick={() => {
                    setSearchQuery(player.name);
                    setShowSearchDropdown(false);
                  }}
                >
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-2">👤</span>
                    <span className="font-medium">{player.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filteredPhotos.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-8xl mb-6">📸</div>
          <h3 className="text-2xl font-bold text-slate-700 mb-4">
            {searchQuery ? 'No photos found' : 'No photos yet'}
          </h3>
          <p className="text-slate-500 text-lg">
            {searchQuery ? 'Try adjusting your search terms' : 'Be the first to share photos of our team!'}
          </p>
          {!searchQuery && (
            <div className="mt-6">
              <span className="inline-block bg-amber-100 text-amber-800 px-4 py-2 rounded-lg text-sm">
                🎯 Upload the first photo and become a legend!
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPhotos.map((photo, index) => (
            <div 
              key={photo.id} 
              className="photo-card bg-white rounded-xl overflow-hidden cursor-pointer group"
              onClick={() => openLightbox(photo, index)}
            >
              <div className="relative">
                <img
                  src={photo.url}
                  alt={photo.caption || 'Hawks Baseball Photo'}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x300/e2e8f0/64748b?text=Image+Error"; }}
                />

              </div>
              <div className="p-4">
                {photo.caption && (
                  <p className="text-slate-800 font-semibold text-sm mb-3 line-clamp-2">{photo.caption}</p>
                )}
                {/* Tags display */}
                {photo.tags && photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {photo.tags.map(tag => (
                      <span key={tag} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        👤 {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-slate-500 text-xs">
                  📅 {photo.timestamp && new Date(photo.timestamp.toDate()).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const { auth, userId, isAuthReady, firebaseInitError } = useFirebase();
  const [activeTab, setActiveTab] = useState('home');
  const [refreshGallery, setRefreshGallery] = useState(0);
  const handleUploadSuccess = () => {
    setRefreshGallery(prev => prev + 1);
    setActiveTab('gallery');
  };
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="text-xl font-semibold text-slate-700">Initializing app...</div>
      </div>
    );
  }
  if (firebaseInitError) {
    return <Modal message={firebaseInitError} onClose={() => {}} />;
  }
  if (!userId) {
    return <Auth />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans text-slate-900">
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
        }
        .hawk-logo {
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nav-button {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .nav-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }
        .nav-button:hover::before {
          left: 100%;
        }
        .photo-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .photo-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        .search-input {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(30, 58, 138, 0.1);
        }
        .search-input:focus {
          border-color: #1e3a8a;
          box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
        }
        `}
      </style>
      
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white shadow-2xl border-b-4 border-amber-400">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between">
            {/* Logo Section */}
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="relative mr-4">
                {/* Hawk Logo - Replace src with your actual logo image */}
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="Hawks Baseball Logo"
                    className="w-full h-full object-contain"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                    onError={(e) => {
                      console.log('Logo image failed to load, showing fallback');
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                    onLoad={(e) => {
                      console.log('Logo image loaded successfully');
                    }}
                  />
                  <svg className="w-10 h-10 text-white hidden" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                {/* Baseball Bats */}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold hawk-logo">Hawks Baseball</h1>
                <p className="text-amber-400 text-sm font-medium">San Diego, CA • Cooperstown</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex flex-wrap justify-center gap-2 lg:gap-4">
              <button
                onClick={() => setActiveTab('home')}
                className={`nav-button px-6 py-3 rounded-xl text-lg font-semibold transition-all duration-300 ${
                  activeTab === 'home' 
                    ? 'bg-amber-400 text-slate-900 shadow-lg transform scale-105' 
                    : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
                }`}
              >
                🏠 Home
              </button>
              <button
                onClick={() => setActiveTab('gallery')}
                className={`nav-button px-6 py-3 rounded-xl text-lg font-semibold transition-all duration-300 ${
                  activeTab === 'gallery' 
                    ? 'bg-amber-400 text-slate-900 shadow-lg transform scale-105' 
                    : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
                }`}
              >
                📸 Gallery
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`nav-button px-6 py-3 rounded-xl text-lg font-semibold transition-all duration-300 ${
                  activeTab === 'upload' 
                    ? 'bg-amber-400 text-slate-900 shadow-lg transform scale-105' 
                    : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
                }`}
              >
                ⬆️ Upload
              </button>
              <button
                onClick={() => signOut(auth)}
                className="nav-button px-6 py-3 rounded-xl text-lg font-semibold bg-red-600 text-white hover:bg-red-700 hover:scale-105 transition-all duration-300"
              >
                🚪 Sign Out
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 py-8">
        {activeTab === 'home' && <Homepage />}
        {activeTab === 'gallery' && <PhotoGallery key={refreshGallery} />}
        {activeTab === 'upload' && <PhotoUpload onUploadSuccess={handleUploadSuccess} />}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-6 mt-8 border-t-4 border-amber-400">
        <div className="container mx-auto text-center">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <p className="text-lg font-semibold">🏆 Hawks Baseball 2025</p>
              <p className="text-amber-400 text-sm">Cooperstown Dreams Park</p>
            </div>

          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} Hawks Baseball. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const RootApp = () => (
  <FirebaseProvider>
    <App />
  </FirebaseProvider>
);

export default RootApp; 